import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover'
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function syncFromStripe() {
    console.log('🔄 Syncing from Stripe to Supabase...\n');

    try {
        // Sync Products
        console.log('📦 Syncing products...');
        const products = await stripe.products.list({ limit: 100 });

        for (const product of products.data) {
            const { error } = await supabase.from('products').upsert({
                id: product.id,
                active: product.active,
                name: product.name,
                description: product.description || null,
                image: product.images?.[0] || null,
                metadata: product.metadata
            });

            if (error) {
                console.error(`  ❌ Error syncing product ${product.name}:`, error.message);
            } else {
                console.log(`  ✅ Synced product: ${product.name}`);
            }
        }

        // Sync Prices
        console.log('\n💰 Syncing prices...');
        const prices = await stripe.prices.list({ limit: 100 });

        for (const price of prices.data) {
            const { error } = await supabase.from('prices').upsert({
                id: price.id,
                product_id: typeof price.product === 'string' ? price.product : price.product.id,
                active: price.active,
                currency: price.currency,
                type: price.type,
                unit_amount: price.unit_amount || null,
                interval: price.recurring?.interval || null,
                interval_count: price.recurring?.interval_count || null,
                trial_period_days: price.recurring?.trial_period_days || null,
                metadata: price.metadata,
                description: price.nickname || null
            });

            if (error) {
                console.error(`  ❌ Error syncing price ${price.id}:`, error.message);
            } else {
                console.log(`  ✅ Synced price: ${price.nickname || price.id} ($${(price.unit_amount || 0) / 100})`);
            }
        }

        console.log('\n✨ Sync from Stripe complete!');

    } catch (error) {
        console.error('❌ Error syncing from Stripe:', error);
        process.exit(1);
    }
}

syncFromStripe();
