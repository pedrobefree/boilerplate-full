
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// NOTE: We use a direct service role client here for webhook handling to bypass specific RLS that might block system updates
// or to ensure we have full access to write products/prices.
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { error } = await supabaseAdmin.from('products').upsert([productData]);
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

    const { error } = await supabaseAdmin.from('prices').upsert([priceData]);
    if (error) throw error;
    console.log(`Price inserted/updated: ${price.id}`);
};

/**
 * Manages subscription status updates.
 */
export const manageSubscriptionStatusChange = async (
    subscriptionId: string,
    customerId: string,
    createAction = false
) => {
    // 1. Retrieve the latest subscription data from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method']
    }) as any;

    // 2. Find the Organization associated with this customer
    const { data: orgs, error: orgError } = await supabaseAdmin
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

    const { error } = await supabaseAdmin
        .from('subscriptions')
        .upsert([subscriptionData]);

    if (error) throw error;
    console.log(`Subscription inserted/updated: ${subscription.id} for Org ${org.id}`);

    // 4. Update Organization's generic status column if needed
    // (Optional shorthand for easier querying)
    await supabaseAdmin
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
    const { error } = await supabaseAdmin
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
    billingDetails?: any
) => {
    // 1. Fetch current order to check for user association
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

    if (orderError || !order) {
        console.error(`Order with PI ${paymentIntentId} not found:`, orderError);
        return;
    }

    let userId = order.user_id;
    let magicLink = null;
    const email = billingDetails?.email || order.billing_details?.email;
    const name = billingDetails?.name || order.billing_details?.name;

    // 2. User Lifecycle Management (US4)
    if (!userId && email) {
        // Find existing user by email
        const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = userData.users.find(u => u.email === email);

        if (existingUser) {
            userId = existingUser.id;
        } else {
            // Create new user (role: 'user')
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                user_metadata: { full_name: name },
                email_confirm: true,
                role: 'user'
            });

            if (createError) {
                console.error("Error creating user:", createError);
            } else if (newUser.user) {
                userId = newUser.user.id;

                // Generate Magic Link
                const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email,
                    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` }
                });

                if (linkError) {
                    console.error("Error generating magic link:", linkError);
                } else {
                    magicLink = linkData.properties.action_link;
                }
            }
        }
    }

    // 3. Organization Membership (Customer role)
    if (userId && order.organization_id) {
        const { data: existingMember } = await supabaseAdmin
            .from('organization_members')
            .select('id')
            .eq('organization_id', order.organization_id)
            .eq('user_id', userId)
            .single();

        if (!existingMember) {
            await supabaseAdmin
                .from('organization_members')
                .insert({
                    organization_id: order.organization_id,
                    user_id: userId,
                    role: 'customer'
                });
        }
    }

    // 4. Profile Auto-fill (US6)
    if (userId && billingDetails?.address) {
        const address = billingDetails.address;
        const profileUpdate: any = {};

        // Only update if current profile fields are null/empty
        const { data: profile } = await supabaseAdmin
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
                await supabaseAdmin
                    .from('profiles')
                    .update(profileUpdate)
                    .eq('id', userId);
            }
        }
    }

    // 5. Final Order Update
    const updateData: any = {
        status,
        billing_details: billingDetails ?? order.billing_details,
        user_id: userId
    };

    if (magicLink) {
        updateData.magic_link = magicLink;
    }

    const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

    if (updateError) {
        throw updateError;
    }
    console.log(`Updated order ${order.id} to status ${status}. User: ${userId}`);
};
