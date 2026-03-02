import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function resetCatalog() {
    console.log('🗑️  Clearing catalog data...');

    // Delete in order to respect foreign keys
    // Product Tags -> Products, Tags
    const { error: ptError } = await supabase.from('product_tags').delete().neq('product_id', 'placeholder');
    if (ptError) console.error('Error deleting product_tags:', ptError.message);

    // Product Images -> Products
    const { error: piError } = await supabase.from('product_images').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (piError) console.error('Error deleting product_images:', piError.message);

    // Prices -> Products
    const { error: prError } = await supabase.from('prices').delete().neq('id', 'placeholder');
    if (prError) console.error('Error deleting prices:', prError.message);

    // Products
    const { error: pError } = await supabase.from('products').delete().neq('id', 'placeholder');
    if (pError) console.error('Error deleting products:', pError.message);

    // Tags
    const { error: tError } = await supabase.from('tags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (tError) console.error('Error deleting tags:', tError.message);

    // Categories
    const { error: cError } = await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (cError) console.error('Error deleting categories:', cError.message);

    console.log('✅ Catalog cleared.');

    console.log('\n🌱 Running seed script...');
    try {
        execSync('npm run seed:catalog', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Error running seed script');
        process.exit(1);
    }

    console.log('\n🔄 Syncing to Stripe...');
    try {
        execSync('npm run sync:stripe', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Error syncing to Stripe');
        process.exit(1);
    }

    console.log('\n✨ Reset complete! Catalog refreshed and synced.');
}

resetCatalog();
