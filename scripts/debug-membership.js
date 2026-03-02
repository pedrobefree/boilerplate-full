#!/usr/bin/env node

/**
 * Debug script to check user's organization membership
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

async function debugUserMembership() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const email = 'superadmin@email.com';

    console.log('\n🔍 Debugging user membership for:', email);
    console.log('='.repeat(60));

    // Get user
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);

    if (!user) {
        console.log('❌ User not found!');
        return;
    }

    console.log('\n✅ User found:', user.id);

    // Get profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    console.log('\n📋 Profile:');
    console.log('   Role:', profile?.role || 'none');
    console.log('   Name:', profile?.full_name || 'none');

    // Get organizations
    const { data: orgs } = await supabase
        .from('organizations')
        .select('*');

    console.log('\n🏢 Organizations:');
    orgs?.forEach(org => {
        console.log(`   - ${org.name} (${org.id})`);
    });

    // Get memberships
    const { data: memberships } = await supabase
        .from('organization_members')
        .select('*, organizations(name)')
        .eq('user_id', user.id);

    console.log('\n👥 Memberships:');
    if (memberships && memberships.length > 0) {
        memberships.forEach(m => {
            const orgName = m.organizations?.name || 'Unknown';
            console.log(`   - ${orgName}: ${m.role} (org_id: ${m.organization_id})`);
        });
    } else {
        console.log('   ❌ No memberships found!');
    }

    // Check RLS policy
    console.log('\n🔒 Testing RLS policy for invitations...');

    if (memberships && memberships.length > 0) {
        const orgId = memberships[0].organization_id;

        // Try to insert an invitation (will fail if RLS blocks it)
        const { data: testInvite, error: inviteError } = await supabase
            .from('organization_invitations')
            .insert({
                organization_id: orgId,
                email: 'test@example.com',
                role: 'member',
                invited_by: user.id
            })
            .select()
            .single();

        if (inviteError) {
            console.log('   ❌ RLS Error:', inviteError.message);
            console.log('   Code:', inviteError.code);
        } else {
            console.log('   ✅ Can create invitations!');
            // Clean up test invitation
            await supabase
                .from('organization_invitations')
                .delete()
                .eq('id', testInvite.id);
        }
    }

    console.log('\n' + '='.repeat(60));
}

debugUserMembership();
