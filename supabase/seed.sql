-- Initial application seed for Supabase.
--
-- Consolidates local seed scripts:
-- - scripts/seed-catalog.js
-- - scripts/seed-super-admin.js
-- - scripts/seed-admin.js
-- - scripts/seed-users.js
--
-- This script is intentionally idempotent and safe to run multiple times in
-- the Supabase SQL editor or via `supabase db reset`.
--
-- It creates one bootstrap Auth user when missing:
-- - superadmin@email.com / 12345678
--
-- Change this password after the first production login.

BEGIN;

-- 1. Default organization
INSERT INTO public.organizations (name, slug)
VALUES ('Befree Academy', 'befree-academy')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- 2. Create bootstrap super admin Auth user when missing.
DO $$
DECLARE
  bootstrap_user_id UUID;
  bootstrap_email TEXT := 'superadmin@email.com';
  bootstrap_password TEXT := '12345678';
BEGIN
  SELECT id
  INTO bootstrap_user_id
  FROM auth.users
  WHERE email = bootstrap_email
  LIMIT 1;

  IF bootstrap_user_id IS NULL THEN
    bootstrap_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      bootstrap_user_id,
      'authenticated',
      'authenticated',
      bootstrap_email,
      extensions.crypt(bootstrap_password, extensions.gen_salt('bf')),
      NOW(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::JSONB,
      jsonb_build_object('full_name', 'Super Admin', 'role', 'owner'),
      NOW(),
      NOW()
    );

    IF NOT EXISTS (
      SELECT 1
      FROM auth.identities
      WHERE user_id = bootstrap_user_id
        AND provider = 'email'
    ) THEN
      IF (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'auth'
          AND table_name = 'identities'
          AND column_name = 'id'
      ) = 'uuid' THEN
        INSERT INTO auth.identities (
          id,
          provider_id,
          user_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at
        )
        VALUES (
          bootstrap_user_id,
          bootstrap_user_id::TEXT,
          bootstrap_user_id,
          jsonb_build_object('sub', bootstrap_user_id::TEXT, 'email', bootstrap_email),
          'email',
          NOW(),
          NOW(),
          NOW()
        );
      ELSE
        INSERT INTO auth.identities (
          id,
          provider_id,
          user_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at
        )
        VALUES (
          bootstrap_user_id::TEXT,
          bootstrap_user_id::TEXT,
          bootstrap_user_id,
          jsonb_build_object('sub', bootstrap_user_id::TEXT, 'email', bootstrap_email),
          'email',
          NOW(),
          NOW(),
          NOW()
        );
      END IF;
    END IF;
  END IF;
END $$;

-- 3. Promote/link existing Auth users, if they already exist.
-- Create these users in Supabase Auth first if you want them bootstrapped:
-- - superadmin@email.com
-- - pedro@befree.academy
-- - pedroduarte.lc+1@gmail.com
DO $$
DECLARE
  default_org_id UUID;
  admin_email TEXT;
  member_email TEXT;
  target_user_id UUID;
  target_user_email TEXT;
  target_user_meta JSONB;
  super_admin_emails TEXT[] := ARRAY[
    'superadmin@email.com',
    'pedro@befree.academy'
  ];
  member_emails TEXT[] := ARRAY[
    'pedroduarte.lc+1@gmail.com'
  ];
BEGIN
  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'befree-academy';

  FOREACH admin_email IN ARRAY super_admin_emails LOOP
    target_user_id := NULL;
    target_user_email := NULL;
    target_user_meta := NULL;

    SELECT id, email, raw_user_meta_data
    INTO target_user_id, target_user_email, target_user_meta
    FROM auth.users
    WHERE email = admin_email
    LIMIT 1;

    IF target_user_id IS NULL THEN
      RAISE NOTICE 'Auth user % not found. Skipping super admin bootstrap.', admin_email;
    ELSE
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (
        target_user_id,
        target_user_email,
        COALESCE(target_user_meta->>'full_name', 'Super Admin'),
        'super_admin'
      )
      ON CONFLICT (id) DO UPDATE
      SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        role = 'super_admin',
        updated_at = NOW();

      INSERT INTO public.organization_members (organization_id, user_id, role)
      SELECT default_org_id, target_user_id, 'owner'
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = default_org_id
          AND user_id = target_user_id
          AND role = 'owner'
      );
    END IF;
  END LOOP;

  FOREACH member_email IN ARRAY member_emails LOOP
    target_user_id := NULL;
    target_user_email := NULL;
    target_user_meta := NULL;

    SELECT id, email, raw_user_meta_data
    INTO target_user_id, target_user_email, target_user_meta
    FROM auth.users
    WHERE email = member_email
    LIMIT 1;

    IF target_user_id IS NULL THEN
      RAISE NOTICE 'Auth user % not found. Skipping member bootstrap.', member_email;
    ELSE
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (
        target_user_id,
        target_user_email,
        COALESCE(target_user_meta->>'full_name', target_user_email),
        'user'
      )
      ON CONFLICT (id) DO UPDATE
      SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        updated_at = NOW();

      INSERT INTO public.organization_members (organization_id, user_id, role)
      SELECT default_org_id, target_user_id, 'member'
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = default_org_id
          AND user_id = target_user_id
          AND role = 'member'
      );
    END IF;
  END LOOP;
END $$;

-- 4. Categories
INSERT INTO public.categories (name, slug, description)
VALUES
  ('Online Courses', 'online-courses', 'Comprehensive online learning programs and courses'),
  ('Digital Downloads', 'digital-downloads', 'E-books, templates, and digital resources'),
  ('Coaching Programs', 'coaching-programs', 'One-on-one and group coaching sessions'),
  ('Memberships', 'memberships', 'Recurring membership and subscription programs'),
  ('Digital Products', 'digital-products', 'Digital downloads and subscriptions'),
  ('Physical Products', 'physical-products', 'Tangible goods and merchandise'),
  ('Services', 'services', 'Professional services and consulting')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 5. Tags
INSERT INTO public.tags (name, color)
VALUES
  ('Beginner Friendly', '#10B981'),
  ('Advanced', '#8B5CF6'),
  ('Best Seller', '#F59E0B'),
  ('New Release', '#3B82F6'),
  ('Limited Time', '#EF4444'),
  ('Popular', '#EC4899'),
  ('New', '#10B981'),
  ('Featured', '#F59E0B'),
  ('Sale', '#EF4444')
ON CONFLICT (name) DO UPDATE
SET color = EXCLUDED.color;

-- 6. Products
WITH default_org AS (
  SELECT id
  FROM public.organizations
  WHERE slug = 'befree-academy'
),
product_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'prod_web_dev_bootcamp',
        TRUE,
        'Complete Web Development Bootcamp',
        'Learn HTML, CSS, JavaScript, React, Node.js and more in this comprehensive bootcamp. Perfect for beginners looking to start a career in web development.',
        NULL::TEXT,
        'web-dev-bootcamp',
        'online-courses',
        19999::BIGINT,
        0
      ),
      (
        'prod_advanced_react',
        TRUE,
        'Advanced React Patterns',
        'Master advanced React patterns including hooks, context, render props, and compound components. Take your React skills to the next level.',
        NULL::TEXT,
        'advanced-react-patterns',
        'online-courses',
        14999::BIGINT,
        0
      ),
      (
        'prod_design_system',
        TRUE,
        'UI/UX Design System Template',
        'A complete design system template with components, tokens, and documentation. Built with Figma and ready to customize for your projects.',
        NULL::TEXT,
        'design-system-template',
        'digital-downloads',
        7999::BIGINT,
        0
      ),
      (
        'prod_personal_branding',
        TRUE,
        'Personal Branding Coaching',
        '12-week one-on-one coaching program to build and grow your personal brand. Includes weekly sessions and personalized strategy.',
        NULL::TEXT,
        'personal-branding-coaching',
        'coaching-programs',
        249999::BIGINT,
        10
      ),
      (
        'prod_dev_community',
        TRUE,
        'Developer Community Membership',
        'Monthly membership with access to exclusive content, live Q&A sessions, code reviews, and a private community of developers.',
        NULL::TEXT,
        'dev-community-membership',
        'memberships',
        2999::BIGINT,
        0
      ),
      (
        'prod_freelancing_guide',
        TRUE,
        'Freelancing Success Guide',
        'Complete guide to starting and growing a successful freelancing business. Includes contracts, pricing strategies, and client management tips.',
        NULL::TEXT,
        'freelancing-guide',
        'digital-downloads',
        4999::BIGINT,
        0
      )
  ) AS product_data (
    id,
    active,
    name,
    description,
    image,
    slug,
    category_slug,
    unit_amount,
    stock_quantity
  )
)
INSERT INTO public.products (
  id,
  active,
  name,
  description,
  image,
  category_id,
  featured_image_index,
  metadata
)
SELECT
  product_seed.id,
  product_seed.active,
  product_seed.name,
  product_seed.description,
  product_seed.image,
  categories.id,
  0,
  jsonb_build_object(
    'slug', product_seed.slug,
    'price', (product_seed.unit_amount::NUMERIC / 100),
    'category', product_seed.category_slug,
    'organization_id', default_org.id,
    'stock_quantity', product_seed.stock_quantity
  )
FROM product_seed
CROSS JOIN default_org
JOIN public.categories ON categories.slug = product_seed.category_slug
ON CONFLICT (id) DO UPDATE
SET
  active = EXCLUDED.active,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image = EXCLUDED.image,
  category_id = EXCLUDED.category_id,
  featured_image_index = EXCLUDED.featured_image_index,
  metadata = EXCLUDED.metadata;

-- 7. Prices
INSERT INTO public.prices (
  id,
  product_id,
  active,
  description,
  unit_amount,
  currency,
  type,
  "interval",
  interval_count,
  trial_period_days,
  metadata
)
VALUES
  (
    'price_web_dev_bootcamp_usd',
    'prod_web_dev_bootcamp',
    TRUE,
    'Complete Web Development Bootcamp',
    19999,
    'usd',
    'one_time',
    NULL,
    NULL,
    NULL,
    '{"seeded": true}'::JSONB
  ),
  (
    'price_advanced_react_usd',
    'prod_advanced_react',
    TRUE,
    'Advanced React Patterns',
    14999,
    'usd',
    'one_time',
    NULL,
    NULL,
    NULL,
    '{"seeded": true}'::JSONB
  ),
  (
    'price_design_system_usd',
    'prod_design_system',
    TRUE,
    'UI/UX Design System Template',
    7999,
    'usd',
    'one_time',
    NULL,
    NULL,
    NULL,
    '{"seeded": true}'::JSONB
  ),
  (
    'price_personal_branding_usd',
    'prod_personal_branding',
    TRUE,
    'Personal Branding Coaching',
    249999,
    'usd',
    'one_time',
    NULL,
    NULL,
    NULL,
    '{"seeded": true}'::JSONB
  ),
  (
    'price_dev_community_monthly_usd',
    'prod_dev_community',
    TRUE,
    'Developer Community Membership (Monthly)',
    2999,
    'usd',
    'recurring',
    'month',
    1,
    NULL,
    '{"seeded": true}'::JSONB
  ),
  (
    'price_freelancing_guide_usd',
    'prod_freelancing_guide',
    TRUE,
    'Freelancing Success Guide',
    4999,
    'usd',
    'one_time',
    NULL,
    NULL,
    NULL,
    '{"seeded": true}'::JSONB
  )
ON CONFLICT (id) DO UPDATE
SET
  product_id = EXCLUDED.product_id,
  active = EXCLUDED.active,
  description = EXCLUDED.description,
  unit_amount = EXCLUDED.unit_amount,
  currency = EXCLUDED.currency,
  type = EXCLUDED.type,
  "interval" = EXCLUDED."interval",
  interval_count = EXCLUDED.interval_count,
  trial_period_days = EXCLUDED.trial_period_days,
  metadata = EXCLUDED.metadata;

-- 8. Product tags
WITH product_tag_seed (product_id, tag_name) AS (
  VALUES
    ('prod_web_dev_bootcamp', 'Beginner Friendly'),
    ('prod_web_dev_bootcamp', 'Best Seller'),
    ('prod_advanced_react', 'Advanced'),
    ('prod_advanced_react', 'Popular'),
    ('prod_design_system', 'New Release'),
    ('prod_personal_branding', 'Limited Time'),
    ('prod_dev_community', 'Best Seller'),
    ('prod_dev_community', 'Popular'),
    ('prod_freelancing_guide', 'Beginner Friendly')
)
INSERT INTO public.product_tags (product_id, tag_id)
SELECT product_tag_seed.product_id, tags.id
FROM product_tag_seed
JOIN public.tags ON tags.name = product_tag_seed.tag_name
ON CONFLICT (product_id, tag_id) DO NOTHING;

COMMIT;
