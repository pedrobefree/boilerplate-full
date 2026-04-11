import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = `test-smoke-${Date.now()}@example.com`;
  
  // Create test user
  console.log(`Creating user: ${email}...`);
  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'customer' }
  });

  if (createError) {
    console.error("Failed to create user:", createError);
    process.exit(1);
  }

  console.log(`Generated user: ${user.user.id}`);

  // Generate Magic Link exactly as admin.ts does
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  console.log(`Generating link to redirectTo: ${siteUrl}/auth/confirm`);
  
  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/auth/confirm` }
  });

  if (linkError) {
    console.error("Failed to generate link:", linkError);
    process.exit(1);
  }

  console.log("\n✅ Test Magic Link Generated successfully!");
  console.log("--------------------------------------------------");
  console.log(link.properties.action_link);
  console.log("--------------------------------------------------\n");
}

run();
