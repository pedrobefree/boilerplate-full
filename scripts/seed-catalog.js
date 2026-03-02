import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function seedCatalog() {
    console.log('🌱 Seeding Catalog Data...\n');

    try {
        // Get Befree Academy organization ID
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', 'befree-academy')
            .single();

        if (orgError || !org) {
            throw new Error('Befree Academy organization not found');
        }

        console.log('✅ Found Befree Academy organization:', org.id);

        // Seed Categories
        console.log('\n📂 Creating categories...');
        const categories = [
            {
                name: 'Online Courses',
                slug: 'online-courses',
                description: 'Comprehensive online learning programs and courses'
            },
            {
                name: 'Digital Downloads',
                slug: 'digital-downloads',
                description: 'E-books, templates, and digital resources'
            },
            {
                name: 'Coaching Programs',
                slug: 'coaching-programs',
                description: 'One-on-one and group coaching sessions'
            },
            {
                name: 'Memberships',
                slug: 'memberships',
                description: 'Recurring membership and subscription programs'
            }
        ];

        const { data: createdCategories, error: catError } = await supabase
            .from('categories')
            .upsert(categories, { onConflict: 'slug', ignoreDuplicates: false })
            .select();

        if (catError) throw catError;
        console.log(`✅ Created ${createdCategories.length} categories`);

        // Seed Tags
        console.log('\n🏷️  Creating tags...');
        const tags = [
            { name: 'Beginner Friendly', color: '#10B981' },
            { name: 'Advanced', color: '#8B5CF6' },
            { name: 'Best Seller', color: '#F59E0B' },
            { name: 'New Release', color: '#3B82F6' },
            { name: 'Limited Time', color: '#EF4444' },
            { name: 'Popular', color: '#EC4899' }
        ];

        const { data: createdTags, error: tagError } = await supabase
            .from('tags')
            .upsert(tags, { onConflict: 'name', ignoreDuplicates: false })
            .select();

        if (tagError) throw tagError;
        console.log(`✅ Created ${createdTags.length} tags`);

        // Seed Products
        console.log('\n📦 Creating products...');
        const products = [
            {
                id: 'prod_web_dev_bootcamp',
                active: true,
                name: 'Complete Web Development Bootcamp',
                description: 'Learn HTML, CSS, JavaScript, React, Node.js and more in this comprehensive bootcamp. Perfect for beginners looking to start a career in web development.',
                image: null,
                metadata: {
                    slug: 'web-dev-bootcamp',
                    price: 199.99,
                    category: 'online-courses',
                    organization_id: org.id
                }
            },
            {
                id: 'prod_advanced_react',
                active: true,
                name: 'Advanced React Patterns',
                description: 'Master advanced React patterns including hooks, context, render props, and compound components. Take your React skills to the next level.',
                image: null,
                metadata: {
                    slug: 'advanced-react-patterns',
                    price: 149.99,
                    category: 'online-courses',
                    organization_id: org.id
                }
            },
            {
                id: 'prod_design_system',
                active: true,
                name: 'UI/UX Design System Template',
                description: 'A complete design system template with components, tokens, and documentation. Built with Figma and ready to customize for your projects.',
                image: null,
                metadata: {
                    slug: 'design-system-template',
                    price: 79.99,
                    category: 'digital-downloads',
                    organization_id: org.id
                }
            },
            {
                id: 'prod_personal_branding',
                active: true,
                name: 'Personal Branding Coaching',
                description: '12-week one-on-one coaching program to build and grow your personal brand. Includes weekly sessions and personalized strategy.',
                image: null,
                metadata: {
                    slug: 'personal-branding-coaching',
                    price: 2499.99,
                    category: 'coaching-programs',
                    organization_id: org.id,
                    stock_quantity: 10
                }
            },
            {
                id: 'prod_dev_community',
                active: true,
                name: 'Developer Community Membership',
                description: 'Monthly membership with access to exclusive content, live Q&A sessions, code reviews, and a private community of developers.',
                image: null,
                metadata: {
                    slug: 'dev-community-membership',
                    price: 29.99,
                    category: 'memberships',
                    organization_id: org.id
                }
            },
            {
                id: 'prod_freelancing_guide',
                active: true,
                name: 'Freelancing Success Guide',
                description: 'Complete guide to starting and growing a successful freelancing business. Includes contracts, pricing strategies, and client management tips.',
                image: null,
                metadata: {
                    slug: 'freelancing-guide',
                    price: 49.99,
                    category: 'digital-downloads',
                    organization_id: org.id
                }
            }
        ];

        const { data: createdProducts, error: prodError } = await supabase
            .from('products')
            .upsert(products, { onConflict: 'id', ignoreDuplicates: false })
            .select();

        if (prodError) throw prodError;
        console.log(`✅ Created ${createdProducts.length} products`);

        // Assign tags to products
        console.log('\n🔗 Assigning tags to products...');
        const productTags = [
            // Web Dev Bootcamp - Beginner Friendly, Best Seller
            { product_id: 'prod_web_dev_bootcamp', tag_id: createdTags.find(t => t.name === 'Beginner Friendly')?.id },
            { product_id: 'prod_web_dev_bootcamp', tag_id: createdTags.find(t => t.name === 'Best Seller')?.id },
            // Advanced React - Advanced, Popular
            { product_id: 'prod_advanced_react', tag_id: createdTags.find(t => t.name === 'Advanced')?.id },
            { product_id: 'prod_advanced_react', tag_id: createdTags.find(t => t.name === 'Popular')?.id },
            // Design System - New Release
            { product_id: 'prod_design_system', tag_id: createdTags.find(t => t.name === 'New Release')?.id },
            // Personal Branding - Limited Time
            { product_id: 'prod_personal_branding', tag_id: createdTags.find(t => t.name === 'Limited Time')?.id },
            // Dev Community - Best Seller, Popular
            { product_id: 'prod_dev_community', tag_id: createdTags.find(t => t.name === 'Best Seller')?.id },
            { product_id: 'prod_dev_community', tag_id: createdTags.find(t => t.name === 'Popular')?.id },
            // Freelancing Guide - Beginner Friendly
            { product_id: 'prod_freelancing_guide', tag_id: createdTags.find(t => t.name === 'Beginner Friendly')?.id }
        ];

        const { error: tagAssignError } = await supabase
            .from('product_tags')
            .upsert(productTags, { onConflict: 'product_id,tag_id', ignoreDuplicates: true });

        if (tagAssignError) throw tagAssignError;
        console.log(`✅ Assigned tags to products`);

        console.log('\n🎉 Catalog seeding complete!\n');
        console.log('Summary:');
        console.log(`   Categories: ${createdCategories.length}`);
        console.log(`   Tags: ${createdTags.length}`);
        console.log(`   Products: ${createdProducts.length}`);

    } catch (error) {
        console.error('❌ Error seeding catalog:', error);
        process.exit(1);
    }
}

seedCatalog();
