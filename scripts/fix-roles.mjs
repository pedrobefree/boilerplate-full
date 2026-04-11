import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321', 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    
    for (const u of users.users) {
        if (u.role === 'user') {
            console.log(`Fixing user: ${u.email} (${u.id})`);
            const { error: updateError } = await supabase.auth.admin.updateUserById(u.id, {
                role: 'authenticated'
            });
            if (updateError) console.error("Error updating", u.email, updateError);
            else console.log("Success:", u.email);
        }
    }
    console.log("Done");
}
run();
