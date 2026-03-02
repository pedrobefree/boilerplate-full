
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Role Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function seedSuperAdmin() {
    console.log('Seeding Super Admin...');

    // 1. Get the first user
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (userError) {
        console.error('Error fetching users:', userError);
        return;
    }

    if (!users || users.length === 0) {
        console.log('No users found. Please sign up a user first.');
        return;
    }

    const targetUser = users[0];
    console.log(`Promoting user ${targetUser.email} (${targetUser.id}) to Super Admin...`);

    // 2. Update their profile role
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', targetUser.id);

    if (updateError) {
        console.error('Error updating profile:', updateError);
    } else {
        console.log('Success! User promoted to Super Admin.');
    }
}

seedSuperAdmin();
