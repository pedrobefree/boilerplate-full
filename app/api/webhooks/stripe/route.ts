import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import {
    upsertProductRecord,
    upsertPriceRecord,
    manageSubscriptionStatusChange,
    updateOrderStatus
} from '@/lib/stripe/admin';

const relevantEvents = new Set([
    'product.created',
    'product.updated',
    'product.deleted',
    'price.created',
    'price.updated',
    'price.deleted',
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'payment_intent.succeeded',
    'payment_intent.payment_failed'
]);

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
        if (!sig || !webhookSecret) {
            console.error('Missing signature or webhook secret');
            return NextResponse.json({ error: 'Webhook configuration error' }, { status: 400 });
        }

        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        console.log(`🔔 Webhook received: ${event.type}`);
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (relevantEvents.has(event.type)) {
        try {
            switch (event.type) {
                case 'product.created':
                case 'product.updated':
                    await upsertProductRecord(event.data.object as Stripe.Product);
                    break;
                case 'price.created':
                case 'price.updated':
                    await upsertPriceRecord(event.data.object as Stripe.Price);
                    break;
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    const subscription = event.data.object as Stripe.Subscription;
                    await manageSubscriptionStatusChange(
                        subscription.id,
                        subscription.customer as string,
                        event.type === 'customer.subscription.created'
                    );
                    break;
                case 'payment_intent.succeeded':
                    const piSucceeded = event.data.object as Stripe.PaymentIntent;
                    await updateOrderStatus(
                        piSucceeded.id,
                        'Payment Approved',
                        (piSucceeded as any).shipping || (piSucceeded as any).billing_details
                    );
                    break;
                case 'payment_intent.payment_failed':
                    await updateOrderStatus(
                        (event.data.object as Stripe.PaymentIntent).id,
                        'Canceled'
                    );
                    break;
                default:
                    console.log(`Unhandled relevant event: ${event.type}`);
            }
        } catch (error) {
            console.error(`❌ Error processing webhook: ${error}`);
            return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}
