#!/usr/bin/env node

/**
 * Seed Super Admin User
 * 
 * This script creates a super admin user for local development.
 * 
 * Usage:
 *   node scripts/seed-super-admin.js
 * 
 * Environment:
 *   - SUPABASE_URL (from .env.local)
 *   - SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const SUPER_ADMIN_EMAIL = 'superadmin@email.com';
const SUPER_ADMIN_PASSWORD = '12345678';

async function seedSuperAdmin() {
    console.log('🌱 Seeding Super Admin User...\n');

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ Missing environment variables!');
        console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Check if user already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === SUPER_ADMIN_EMAIL);

        let userId;

        if (existingUser) {
            console.log(`ℹ️  User ${SUPER_ADMIN_EMAIL} already exists`);
            userId = existingUser.id;
        } else {
            // Create the user
            console.log(`📝 Creating user: ${SUPER_ADMIN_EMAIL}`);
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: SUPER_ADMIN_EMAIL,
                password: SUPER_ADMIN_PASSWORD,
                email_confirm: true,
                user_metadata: {
                    full_name: 'Super Admin',
                    is_super_admin: true
                }
            });

            if (createError) {
                throw new Error(`Failed to create user: ${createError.message}`);
            }

            userId = newUser.user.id;
            console.log(`✅ User created with ID: ${userId}`);
        }

        // Ensure profile exists
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            throw new Error(`Failed to check profile: ${profileError.message}`);
        }

        if (!profile) {
            console.log('📝 Creating profile...');
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    full_name: 'Super Admin',
                    role: 'super_admin'
                });

            if (insertError) {
                throw new Error(`Failed to create profile: ${insertError.message}`);
            }
            console.log('✅ Profile created');
        } else if (profile.role !== 'super_admin') {
            console.log('📝 Updating profile to super admin...');
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ role: 'super_admin' })
                .eq('id', userId);

            if (updateError) {
                throw new Error(`Failed to update profile: ${updateError.message}`);
            }
            console.log('✅ Profile updated to super admin');
        } else {
            console.log('✅ Profile already has super admin role');
        }

        // Get or create Befree Academy organization
        const { data: orgs } = await supabase
            .from('organizations')
            .select('*')
            .eq('name', 'Befree Academy')
            .single();

        let orgId;
        if (orgs) {
            orgId = orgs.id;
            console.log(`✅ Found Befree Academy organization: ${orgId}`);
        } else {
            console.log('📝 Creating Befree Academy organization...');
            const { data: newOrg, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: 'Befree Academy',
                    slug: 'befree-academy'
                })
                .select()
                .single();

            if (orgError) {
                throw new Error(`Failed to create organization: ${orgError.message}`);
            }
            orgId = newOrg.id;
            console.log(`✅ Organization created: ${orgId}`);
        }

        // Check if user is already a member
        const { data: membership } = await supabase
            .from('organization_members')
            .select('*')
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .single();

        if (!membership) {
            console.log('📝 Adding user to organization...');
            const { error: memberError } = await supabase
                .from('organization_members')
                .insert({
                    user_id: userId,
                    organization_id: orgId,
                    role: 'owner'
                });

            if (memberError) {
                throw new Error(`Failed to add user to organization: ${memberError.message}`);
            }
            console.log('✅ User added to organization as owner');
        } else if (membership.role !== 'owner') {
            console.log('📝 Updating user role to owner...');
            const { error: updateError } = await supabase
                .from('organization_members')
                .update({ role: 'owner' })
                .eq('user_id', userId)
                .eq('organization_id', orgId);

            if (updateError) {
                throw new Error(`Failed to update user role: ${updateError.message}`);
            }
            console.log('✅ User role updated to owner');
        } else {
            console.log('✅ User already owner of organization');
        }

        console.log('\n🎉 Super Admin seeding complete!\n');
        console.log('Login credentials:');
        console.log(`   Email:    ${SUPER_ADMIN_EMAIL}`);
        console.log(`   Password: ${SUPER_ADMIN_PASSWORD}\n`);

    } catch (error) {
        console.error('\n❌ Seeding failed:', error.message);
        process.exit(1);
    }
}

seedSuperAdmin();
