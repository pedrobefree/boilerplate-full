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

async function syncToStripe() {
    console.log('🔄 Syncing local products to Stripe...\n');

    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('❌ STRIPE_SECRET_KEY not found in .env.local');
        process.exit(1);
    }

    // Get local products
    const { data: products, error } = await supabase
        .from('products')
        .select('*');

    if (error) {
        console.error('❌ Error fetching products from Supabase:', error);
        process.exit(1);
    }

    if (!products || products.length === 0) {
        console.log('⚠️  No products found in local database.');
        console.log('Run: npm run seed:catalog\n');
        process.exit(0);
    }

    console.log(`Found ${products.length} products to sync\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const product of products) {
        try {
            // Check if product exists in Stripe
            let stripeProduct;
            let isNew = false;

            try {
                stripeProduct = await stripe.products.retrieve(product.id);
                console.log(`  ✓ ${product.name} - Already exists in Stripe`);
                updated++;
            } catch (e) {
                // Product doesn't exist, create it
                stripeProduct = await stripe.products.create({
                    id: product.id,
                    name: product.name,
                    description: product.description || undefined,
                    active: product.active !== false,
                    metadata: product.metadata || {}
                });
                console.log(`  ✅ ${product.name} - Created in Stripe`);
                created++;
                isNew = true;
            }

            // Create price if metadata contains price info
            if (product.metadata?.price) {
                try {
                    // Check if a price already exists for this product
                    const existingPrices = await stripe.prices.list({
                        product: product.id,
                        active: true,
                        limit: 1
                    });

                    if (existingPrices.data.length > 0) {
                        if (!isNew) {
                            console.log(`     ✓ Price already exists`);
                        }
                    } else {
                        const newPrice = await stripe.prices.create({
                            product: product.id,
                            unit_amount: Math.round(product.metadata.price * 100), // Convert to cents
                            currency: 'usd',
                            nickname: `${product.name} - Default Price`,
                            metadata: {
                                category: product.metadata.category || '',
                                slug: product.metadata.slug || ''
                            }
                        });
                        console.log(`     ✅ Created price: $${product.metadata.price}`);
                    }
                } catch (e) {
                    console.error(`     ❌ Error creating price: ${e.message}`);
                }
            }
        } catch (error) {
            console.error(`  ❌ Error syncing ${product.name}:`, error.message);
            skipped++;
        }
    }

    console.log('\n🎉 Sync complete!');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log('\n💡 View your products at: https://dashboard.stripe.com/test/products\n');
}

syncToStripe();
