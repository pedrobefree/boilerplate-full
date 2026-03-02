import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover'
});

async function testStripe() {
    try {
        console.log('🔍 Testing Stripe connection...\n');

        if (!process.env.STRIPE_SECRET_KEY) {
            console.error('❌ STRIPE_SECRET_KEY not found in .env.local');
            console.log('\nPlease add your Stripe secret key to .env.local:');
            console.log('STRIPE_SECRET_KEY=sk_test_your_key_here\n');
            process.exit(1);
        }

        // Test connection by listing products
        const products = await stripe.products.list({ limit: 10 });
        console.log(`✅ Connected to Stripe successfully!`);
        console.log(`📦 Found ${products.data.length} products in your Stripe account\n`);

        if (products.data.length > 0) {
            console.log('Products:');
            products.data.forEach(p => {
                console.log(`  - ${p.name} (${p.id}) - ${p.active ? '✓ Active' : '✗ Inactive'}`);
            });
        } else {
            console.log('No products found. You can create one in the Stripe Dashboard or run:');
            console.log('  npm run sync:stripe\n');
        }

        // Test webhook secret
        console.log('\n🔐 Webhook Configuration:');
        if (process.env.STRIPE_WEBHOOK_SECRET) {
            console.log('  ✅ STRIPE_WEBHOOK_SECRET is configured');
        } else {
            console.log('  ⚠️  STRIPE_WEBHOOK_SECRET not found');
            console.log('  Run: stripe listen --forward-to localhost:3000/api/webhooks');
            console.log('  Then copy the webhook secret to .env.local\n');
        }

    } catch (error) {
        console.error('❌ Stripe connection failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Verify your STRIPE_SECRET_KEY in .env.local');
        console.log('2. Make sure you\'re using a test key (starts with sk_test_)');
        console.log('3. Check your internet connection\n');
        process.exit(1);
    }
}

testStripe();
