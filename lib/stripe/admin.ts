
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
 */
export const updateOrderStatus = async (
    paymentIntentId: string,
    status: 'completed' | 'cancelled' | 'processing',
    billingDetails?: any
) => {
    const { error } = await supabaseAdmin
        .from('orders')
        .update({
            status,
            billing_details: billingDetails ?? undefined
        })
        .eq('stripe_payment_intent_id', paymentIntentId);

    if (error) {
        throw error;
    }
    console.log(`Updated order with PI ${paymentIntentId} to status ${status}`);
};
