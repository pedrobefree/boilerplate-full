
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { recordActivity } from "@/lib/activity-log";
import {
    buildAppUrl,
    sendAdminPaymentConfirmedEmail,
    sendOrderCancelledEmail,
    sendOrderConfirmationEmail,
} from "@/lib/email";
import { triggerPasswordEmail } from "@/lib/auth-email";

// NOTE: We use a direct service role client here for webhook handling to bypass specific RLS that might block system updates
// or to ensure we have full access to write products/prices.
let supabaseAdminClient: any = null;

function getSupabaseAdmin(): any {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase admin environment variables.");
    }

    supabaseAdminClient ??= createClient(supabaseUrl, serviceRoleKey);
    return supabaseAdminClient;
}

function getOrderNumber(orderId: string) {
    return orderId.slice(0, 8).toUpperCase();
}

/**
 * Syncs a Stripe Product to Supabase.
 */
export const upsertProductRecord = async (product: Stripe.Product) => {
    const productData = {
        id: product.id,
        active: product.active,
        name: product.name,
        description: product.description ?? undefined,
        image: product.images?.[0] ?? null,
        metadata: product.metadata
    };

    const { error } = await getSupabaseAdmin().from('products').upsert([productData]);
    if (error) throw error;
    console.log(`Product inserted/updated: ${product.id}`);
};

/**
 * Syncs a Stripe Price to Supabase.
 */
export const upsertPriceRecord = async (price: Stripe.Price) => {
    const priceData = {
        id: price.id,
        product_id: typeof price.product === 'string' ? price.product : '',
        active: price.active,
        currency: price.currency,
        description: price.nickname ?? undefined,
        type: price.type,
        unit_amount: price.unit_amount ?? undefined,
        interval: price.recurring?.interval,
        interval_count: price.recurring?.interval_count,
        trial_period_days: price.recurring?.trial_period_days,
        metadata: price.metadata
    };

    const { error } = await getSupabaseAdmin().from('prices').upsert([priceData]);
    if (error) throw error;
    console.log(`Price inserted/updated: ${price.id}`);
};

/**
 * Manages subscription status updates.
 */
export const manageSubscriptionStatusChange = async (
    subscriptionId: string,
    customerId: string,
    _createAction = false
) => {
    // 1. Retrieve the latest subscription data from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method']
    }) as any;

    // 2. Find the Organization associated with this customer
    const { data: orgs, error: orgError } = await getSupabaseAdmin()
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', customerId);

    if (orgError) throw orgError;
    // We assume 1-to-1 customer-to-org mapping for now, or at least 1 org relevant.
    const org = orgs?.[0];

    if (!org) {
        console.error(`Organization with Stripe customer ID "${customerId}" not found.`);
        return;
    }

    // 3. Upsert Subscription
    // access properties safely or cast if TS is complaining about specific version miss-matches
    const current_period_start = subscription.current_period_start;
    const current_period_end = subscription.current_period_end;

    const subscriptionData = {
        id: subscription.id,
        organization_id: org.id,
        metadata: subscription.metadata,
        status: subscription.status,
        price_id: subscription.items.data[0].price.id,
        quantity: subscription.items.data[0].quantity,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        current_period_start: new Date(current_period_start * 1000).toISOString(),
        current_period_end: new Date(current_period_end * 1000).toISOString(),
        created: new Date(subscription.created * 1000).toISOString(),
        ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
    };

    const { error } = await getSupabaseAdmin()
        .from('subscriptions')
        .upsert([subscriptionData]);

    if (error) throw error;
    console.log(`Subscription inserted/updated: ${subscription.id} for Org ${org.id}`);

    // 4. Update Organization's generic status column if needed
    // (Optional shorthand for easier querying)
    await getSupabaseAdmin()
        .from('organizations')
        .update({ subscription_status: subscription.status })
        .eq('id', org.id);
};

/**
 * Links a Supabase Organization to a Stripe Customer.
 * This is crucial when a new customer is created via Checkout.
 */
export const upsertOrganizationCustomer = async (
    organizationId: string,
    stripeCustomerId: string
) => {
    const { error } = await getSupabaseAdmin()
        .from('organizations')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', organizationId);

    if (error) {
        throw error;
    }
    console.log(`Linked Org ${organizationId} to Stripe Customer ${stripeCustomerId}`);
};

/**
 * Updates an order status based on the Stripe PaymentIntent ID.
 * Also handles user creation/association and profile sync.
 */
export const updateOrderStatus = async (
    paymentIntentId: string,
    status: 'Payment Approved' | 'Canceled' | 'Pending Delivery' | 'Completed' | 'Waiting for Payment',
    billingDetails?: any,
    extraStripeData?: { receipt_email?: string | null, customer_email?: string | null, payment_method_id?: string | null }
) => {
    console.log(`[DATA-FLOW] Starting updateOrderStatus for PI: ${paymentIntentId}`);
    
    // 1. Fetch current order to check for user association
    const { data: order, error: orderError } = await getSupabaseAdmin()
        .from('orders')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

    if (orderError || !order) {
        console.error(`[DATA-FLOW] Order with PI ${paymentIntentId} not found in DB.`);
        return;
    }

    if (order.status === status) {
        console.log(`[DATA-FLOW] Skipping duplicate order update for ${order.id}. Status already ${status}.`);
        return;
    }

    let userId = order.user_id;
    let orgId = order.organization_id;
    let magicLink = null;
    let createdNewUser = false;

    // Multi-source email extraction
    const email = billingDetails?.email || 
                  order.billing_details?.email || 
                  extraStripeData?.receipt_email || 
                  extraStripeData?.customer_email;
                  
    const name = billingDetails?.name || order.billing_details?.name;

    console.log(`[DATA-FLOW] Context - UserID: ${userId}, OrgID: ${orgId}, Email: ${email}`);

    // 2. User Lifecycle Management (US4)
    if (!userId && email) {
        console.log(`[DATA-FLOW] Attempting to find/create user for email: ${email}`);
        // Find existing user by email
        const { data: userData } = await getSupabaseAdmin().auth.admin.listUsers();
        const existingUser = userData.users.find((user: { email?: string }) => user.email === email);

        if (existingUser) {
            userId = existingUser.id;
            console.log(`[DATA-FLOW] Found existing user: ${userId}`);
        } else {
            console.log(`[DATA-FLOW] Creating new user for: ${email}`);
            // Create new user
            const { data: newUser, error: createError } = await getSupabaseAdmin().auth.admin.createUser({
                email,
                user_metadata: { 
                    full_name: name,
                    role: 'customer' // Pass role to the auto_join_default_org trigger
                },
                email_confirm: true,
                role: 'authenticated'
            });

            if (createError) {
                console.error("[DATA-FLOW] Error creating user:", createError);
            } else if (newUser.user) {
                userId = newUser.user.id;
                createdNewUser = true;
                console.log(`[DATA-FLOW] New user created: ${userId}`);

                // Generate Magic Link
                // IMPORTANT: Use NEXT_PUBLIC_APP_URL if SITE_URL is missing
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                const { data: linkData, error: linkError } = await getSupabaseAdmin().auth.admin.generateLink({
                    type: 'magiclink',
                    email,
                    options: { redirectTo: `${siteUrl}/auth/confirm` }
                });

                if (linkError) {
                    console.error("[DATA-FLOW] Error generating magic link:", linkError);
                } else {
                    magicLink = linkData.properties.action_link;
                    console.log(`[DATA-FLOW] Magic link generated. action_link: ${magicLink}`);
                }
            }
        }
    }

    // 3. Organization Association & Membership (Customer role)
    // If the user was just created, the Supabase Trigger 'handle_new_user' might be running.
    // We add a small delay and a retry to find the resulting organization_id.
    if (userId && !orgId) {
        console.log(`[DATA-FLOW] Searching for organization for user ${userId}...`);
        
        let attempts = 0;
        while (attempts < 3 && !orgId) {
            if (attempts > 0) {
                console.log(`[DATA-FLOW] Org not found yet, retrying in 1.5s (attempt ${attempts + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            const { data: orgMember } = await getSupabaseAdmin()
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', userId)
                .limit(1);

            if (orgMember && orgMember.length > 0) {
                orgId = orgMember[0].organization_id;
                console.log(`[DATA-FLOW] Found organization: ${orgId}`);
            }
            attempts++;
        }
    }

    if (userId && orgId) {
        // ENSURE the user has the 'customer' role record.
        // This does NOT overwrite other roles (admin, member) because they are now separate records.
        console.log(`[DATA-FLOW] Ensuring 'customer' role record for user ${userId} in org ${orgId}`);
        const { error: memberError } = await getSupabaseAdmin()
            .from('organization_members')
            .upsert({
                organization_id: orgId,
                user_id: userId,
                role: 'customer'
            }, { onConflict: 'organization_id,user_id,role' });

        if (memberError) {
            console.error("[DATA-FLOW] Error ensuring customer role record:", memberError);
        }
    }

    // 4. Profile Auto-fill (US6)
    if (userId && billingDetails?.address) {
        const address = billingDetails.address;
        const profileUpdate: any = {};

        const { data: profile } = await getSupabaseAdmin()
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profile) {
            if (!profile.address_line1) profileUpdate.address_line1 = address.line1;
            if (!profile.address_line2) profileUpdate.address_line2 = address.line2;
            if (!profile.city) profileUpdate.city = address.city;
            if (!profile.state) profileUpdate.state = address.state;
            if (!profile.zip) profileUpdate.zip = address.postal_code;
            if (!profile.country) profileUpdate.country = address.country;
            if (!profile.phone && billingDetails.phone) profileUpdate.phone = billingDetails.phone;
            if (!profile.full_name && name) profileUpdate.full_name = name;

            if (Object.keys(profileUpdate).length > 0) {
                console.log(`[DATA-FLOW] Updating profile for user ${userId}`);
                await getSupabaseAdmin()
                    .from('profiles')
                    .update(profileUpdate)
                    .eq('id', userId);
            }
        }
    }

    // 4.5 Stripe Customer & Payment Method Sync
    if (orgId && extraStripeData?.payment_method_id) {
        // Find existing organization stripe_customer_id
        const { data: orgData } = await getSupabaseAdmin()
             .from('organizations')
             .select('stripe_customer_id, name')
             .eq('id', orgId)
             .single();
             
        let stripeCustomerId = orgData?.stripe_customer_id;
        
        if (!stripeCustomerId && email) {
            console.log(`[DATA-FLOW] Creating Stripe Customer for org ${orgId}`);
            try {
                const customer = await stripe.customers.create({
                    email,
                    name: orgData?.name || name,
                    metadata: { organization_id: orgId }
                });
                stripeCustomerId = customer.id;
                
                await getSupabaseAdmin()
                    .from('organizations')
                    .update({ stripe_customer_id: customer.id })
                    .eq('id', orgId);
                console.log(`[DATA-FLOW] Stripe Customer ${stripeCustomerId} created and linked to org ${orgId}`);
            } catch (err) {
                 console.error("[DATA-FLOW] Error creating Stripe Customer:", err);
            }
        }
        
        if (stripeCustomerId && extraStripeData.payment_method_id) {
             console.log(`[DATA-FLOW] Attaching PM ${extraStripeData.payment_method_id} to customer ${stripeCustomerId}`);
             try {
                  await stripe.paymentMethods.attach(extraStripeData.payment_method_id, { customer: stripeCustomerId });
             } catch (err) {
                  console.error("[DATA-FLOW] Error attaching PM (may already be attached):", err);
             }
        }
    }

    // 5. Final Order Update
    const updateData: any = {
        status,
        billing_details: billingDetails ?? order.billing_details,
        user_id: userId,
        organization_id: orgId
    };

    if (magicLink) {
        updateData.magic_link = magicLink;
    }

    const { error: updateError } = await getSupabaseAdmin()
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

    if (updateError) {
        console.error("[DATA-FLOW] Final order update failed:", updateError);
        throw updateError;
    }

    await recordActivity({
        organizationId: orgId,
        actorId: userId,
        action: status === "Canceled" ? "order_cancelled" : "order_status_changed",
        entityType: "orders",
        entityId: order.id,
        metadata: {
            source: "stripe_webhook",
            previousStatus: order.status,
            nextStatus: status,
            paymentIntentId,
        },
    });

    const orderNumber = getOrderNumber(order.id);

    try {
        let customerEmail = email as string | undefined;
        let customerName = name as string | undefined;

        if (userId) {
            const { data: profile } = await getSupabaseAdmin()
                .from("profiles")
                .select("email, full_name")
                .eq("id", userId)
                .maybeSingle();

            customerEmail = customerEmail || profile?.email || undefined;
            customerName = customerName || profile?.full_name || undefined;
        }

        if (status === "Payment Approved") {
            const { data: items } = await getSupabaseAdmin()
                .from("order_items")
                .select("quantity, unit_amount, product:products(name)")
                .eq("order_id", order.id);

            if (customerEmail) {
                await sendOrderConfirmationEmail({
                    to: customerEmail,
                    customerName,
                    orderNumber,
                    items: (items || []).map((item: any) => ({
                        name: item.product?.name || "Produto",
                        quantity: item.quantity,
                        unitAmount: item.unit_amount || 0,
                    })),
                    totalAmount: order.total_amount,
                    currency: order.currency,
                    orderDate: order.created_at,
                    orderUrl: buildAppUrl(`/orders/${order.id}`),
                });
            }

            if (createdNewUser && customerEmail) {
                await triggerPasswordEmail({
                    email: customerEmail,
                    mode: "welcome",
                    recipientName: customerName,
                    orderNumber,
                    allowWithoutProfile: true,
                });
            }

            if (orgId) {
                const { data: organization } = await getSupabaseAdmin()
                    .from("organizations")
                    .select("name")
                    .eq("id", orgId)
                    .maybeSingle();

                const { data: adminMembers } = await getSupabaseAdmin()
                    .from("organization_members")
                    .select("user_id, role")
                    .eq("organization_id", orgId)
                    .in("role", ["owner", "admin"]);

                const adminIds = Array.from(new Set((adminMembers || []).map((member: { user_id: string }) => member.user_id)));
                if (adminIds.length > 0) {
                    const { data: adminProfiles } = await getSupabaseAdmin()
                        .from("profiles")
                        .select("id, email")
                        .in("id", adminIds);

                    const adminEmails = Array.from(
                        new Set((adminProfiles || []).map((profile: { email?: string | null }) => profile.email).filter(Boolean))
                    ) as string[];

                    if (adminEmails.length > 0) {
                        await sendAdminPaymentConfirmedEmail({
                            to: adminEmails,
                            organizationName: organization?.name || "Organização",
                            orderNumber,
                            customerName,
                            totalAmount: order.total_amount,
                            currency: order.currency,
                            confirmedAt: new Date().toISOString(),
                            orderUrl: buildAppUrl(`/admin/orders/${order.id}`),
                        });
                    }
                }
            }
        }

        if (status === "Canceled" && customerEmail) {
            await sendOrderCancelledEmail({
                to: customerEmail,
                customerName,
                orderNumber,
                orderUrl: buildAppUrl(`/orders/${order.id}`),
                refundWindow: "5 a 10 dias úteis",
            });
        }
    } catch (emailError) {
        console.error("[DATA-FLOW] Transactional email dispatch failed", emailError);
    }

    console.log(`[DATA-FLOW] Order ${order.id} update complete. Status: ${status}, User: ${userId}, Org: ${orgId}`);
};
