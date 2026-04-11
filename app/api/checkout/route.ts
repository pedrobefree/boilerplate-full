import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createClient, createSystemClient } from '@/lib/supabase/server';
import { ProductWithDetails } from '@/app/actions/products';
import { recordActivity } from '@/lib/activity-log';

interface CheckoutItem {
    id: string; // price_id
    product: ProductWithDetails;
    price: NonNullable<ProductWithDetails['prices']>[0];
    quantity: number;
}

export async function POST(req: Request) {
    try {
        const { items } = await req.json() as { items: CheckoutItem[] };

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
        }

        // 1. Calculate amount securely on the server
        // In a strictly secure app, we should fetch prices from Stripe or DB using item.id 
        // to prevent client-side manipulation. For now, we trust the DB price struct sent from client 
        // IF we assume price data isn't tampered. Ideally:
        // const dbPrices = await supabase.from('prices').select('*').in('id', items.map(i => i.id));

        let totalAmount = 0;
        let currency = items[0].price.currency;

        const systemClient = createSystemClient();

        // Fetch prices securely
        const priceIds = items.map(item => item.id);
        const { data: securePrices, error: pricesError } = await systemClient
            .from('prices')
            .select('id, unit_amount, currency')
            .in('id', priceIds);

        if (pricesError || !securePrices) {
            console.error("Error fetching secure prices:", pricesError);
            return NextResponse.json({ error: 'Invalid items in cart' }, { status: 400 });
        }

        for (const item of items) {
            const securePrice = securePrices.find(p => p.id === item.id);
            if (!securePrice || securePrice.unit_amount == null) {
                return NextResponse.json({ error: `Invalid price for item ${item.product.name}` }, { status: 400 });
            }
            totalAmount += securePrice.unit_amount * item.quantity;
        }

        // 2. Associate with Stripe Customer
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let stripeCustomerId: string | undefined = undefined;

        if (user) {
            // Find user's organization to get/set Stripe Customer ID
            const { data: orgData, error: orgError } = await supabase
                .from('organization_members')
                .select('organization_id, organizations!inner(id, stripe_customer_id, name)')
                .eq('user_id', user.id)
                .single();

            if (!orgError && orgData?.organizations) {
                const org = Array.isArray(orgData.organizations) ? orgData.organizations[0] : orgData.organizations;
                if (org.stripe_customer_id) {
                    stripeCustomerId = org.stripe_customer_id;
                } else {
                    // Create a new Stripe Customer
                    const customer = await stripe.customers.create({
                        email: user.email,
                        name: org.name || user.user_metadata?.full_name,
                        metadata: {
                            organization_id: org.id
                        }
                    });

                    stripeCustomerId = customer.id;

                    // Save back to Organization using system client (bypassing specific RLS if needed, or normal client)
                    await systemClient
                        .from('organizations')
                        .update({ stripe_customer_id: customer.id })
                        .eq('id', org.id);
                }
            }
        }

        // 3. Create a PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: currency,
            customer: stripeCustomerId,
            setup_future_usage: 'off_session', // CRITICAL: Makes the Payment Method reusable so we can attach it to the guest's future Customer record
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                cart_items: JSON.stringify(items.map(i => ({ price_id: i.id, quantity: i.quantity })))
            }
        });

        // 4. Create Order and Order Items in DB
        // Get organizationId if available from previous step
        let organizationId = null;
        if (user) {
            const { data: orgMember } = await systemClient
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .single();
            organizationId = orgMember?.organization_id;
        }

        const { data: order, error: orderError } = await systemClient
            .from('orders')
            .insert({
                user_id: user?.id || null,
                organization_id: organizationId,
                status: 'Waiting for Payment',
                total_amount: totalAmount,
                currency: currency,
                stripe_payment_intent_id: paymentIntent.id,
                // billing_details will be updated later via webhook or if collected here
            })
            .select()
            .single();

        if (orderError) {
            console.error("Error creating order:", orderError);
            // We don't necessarily fail the whole request because PI is created, but logging it is critical
        } else if (order) {
            const orderItemsData = items.map(item => ({
                order_id: order.id,
                product_id: item.product.id,
                price_id: item.id,
                quantity: item.quantity,
                unit_amount: securePrices.find(p => p.id === item.id)?.unit_amount
            }));

            const { error: itemsError } = await systemClient
                .from('order_items')
                .insert(orderItemsData);

            if (itemsError) {
                console.error("Error creating order items:", itemsError);
            }

            await recordActivity({
                organizationId,
                actorId: user?.id || null,
                action: "order_created",
                entityType: "orders",
                entityId: order.id,
                metadata: {
                    totalAmount,
                    currency,
                    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
                    paymentIntentId: paymentIntent.id,
                },
            });
        }

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            orderId: order?.id
        });
    } catch (error) {
        console.error('Error creating PaymentIntent:', error);
        return NextResponse.json(
            { error: 'Failed to create payment intent' },
            { status: 500 }
        );
    }
}
