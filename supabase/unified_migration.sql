-- Unified Supabase Migration
-- Run this file to set up the complete database schema
-- Generated from 22+ individual migration files

-- ============================================
-- SECTION 1: Core Tables (Profiles, Orgs, Members)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 1.1 Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  bio TEXT,
  first_name TEXT,
  last_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  invite_expiration_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Organization Members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'customer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_hold', 'completed', 'canceled')),
  key_objective TEXT,
  start_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Project Members
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- 1.6 Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TIMESTAMPTZ,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7 Task Notes
CREATE TABLE IF NOT EXISTS public.task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 2: E-Commerce Tables
-- ============================================

-- 2.1 Products
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  active BOOLEAN,
  name TEXT,
  description TEXT,
  image TEXT,
  metadata JSONB,
  category_id UUID REFERENCES categories(id),
  featured_image_index INT DEFAULT 0
);

-- 2.2 Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Tags
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#000000',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_order INT DEFAULT 0
);

-- 2.5 Product Tags
CREATE TABLE IF NOT EXISTS public.product_tags (
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- 2.6 Prices
CREATE TABLE IF NOT EXISTS public.prices (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES public.products,
  active BOOLEAN,
  description TEXT,
  unit_amount BIGINT,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  type TEXT,
  interval TEXT,
  interval_count INTEGER,
  trial_period_days INTEGER,
  metadata JSONB
);

-- 2.7 Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  status TEXT CHECK (status IN ('Waiting for Payment', 'Payment Approved', 'Pending Delivery', 'Completed', 'Canceled')),
  total_amount BIGINT,
  currency TEXT,
  stripe_payment_intent_id TEXT,
  billing_details JSONB,
  magic_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  price_id TEXT,
  quantity INT DEFAULT 1,
  unit_amount BIGINT
);

-- ============================================
-- SECTION 3: Invitations & Subscriptions
-- ============================================

-- 3.1 Organization Invitations
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'user_removed')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ
);

-- 3.2 Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id TEXT PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  status TEXT CHECK (status IN ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused')),
  metadata JSONB,
  price_id TEXT REFERENCES public.prices,
  quantity INTEGER,
  cancel_at_period_end BOOLEAN,
  created TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  current_period_start TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  current_period_end TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  ended_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  cancel_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  canceled_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  trial_start TIMESTAMPTZ DEFAULT timezone('utc', now()),
  trial_end TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ============================================
-- SECTION 4: Activity Logs
-- ============================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SECTION 5: Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.organization_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.organization_invitations(email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS activity_logs_organization_id_idx ON public.activity_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_actor_id_idx ON public.activity_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_entity_type_idx ON public.activity_logs (entity_type, created_at DESC);

-- ============================================
-- SECTION 6: Enable RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 7: Helper Functions
-- ============================================

-- 7.1 Get user org IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_auth_user_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT ARRAY(
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  );
$$;

-- 7.2 Check super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.3 Check admin or owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;
  
  SELECT om.role INTO user_role
  FROM organization_members om
  WHERE om.user_id = auth.uid()
  AND om.role IN ('admin', 'owner')
  LIMIT 1;
  
  RETURN user_role IS NOT NULL;
END;
$$;

-- 7.4 Slugify function
CREATE OR REPLACE FUNCTION public.slugify(v_text TEXT) RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
BEGIN
  v_slug := lower(v_text);
  v_slug := regexp_replace(v_slug, '[^a-z0-9\s-]', '', 'g');
  v_slug := regexp_replace(v_slug, '\s+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  RETURN v_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- SECTION 8: Trigger Functions
-- ============================================

-- 8.1 Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id, 
    COALESCE(NEW.email, ''), 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.2 Auto-join default org
CREATE OR REPLACE FUNCTION public.auto_join_default_org()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id UUID;
  target_role TEXT;
  user_email TEXT;
  has_pending_invite BOOLEAN;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  -- Check if user has any pending invitations
  SELECT EXISTS (
    SELECT 1 FROM public.organization_invitations
    WHERE email = user_email
    AND status = 'pending'
    AND expires_at > NOW()
  ) INTO has_pending_invite;
  
  -- If user has pending invitations, skip auto-join
  IF has_pending_invite THEN
    RETURN NEW;
  END IF;
  
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'befree-academy';
  
  -- Pick role from metadata or default to 'member'
  target_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');
  
  IF default_org_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (default_org_id, NEW.id, target_role)
    ON CONFLICT (organization_id, user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.3 Accept invitation function
CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation RECORD;
  current_user_id UUID;
  result JSON;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  SELECT * INTO invitation
  FROM organization_invitations
  WHERE token = invite_token
  AND status = 'pending'
  AND expires_at > NOW();
  
  IF invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found or expired');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND email = invitation.email
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = invitation.organization_id
    AND user_id = current_user_id
  ) THEN
    UPDATE organization_invitations 
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = invitation.id;
    
    RETURN json_build_object('success', true, 'message', 'Already a member');
  END IF;
  
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (invitation.organization_id, current_user_id, invitation.role);
  
  UPDATE organization_invitations 
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = invitation.id;
  
  RETURN json_build_object(
    'success', TRUE, 
    'organization_id', invitation.organization_id,
    'role', invitation.role
  );
END;
$$;

-- ============================================
-- SECTION 9: Triggers
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_join_org ON auth.users;
CREATE TRIGGER on_auth_user_created_join_org
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_join_default_org();

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- ============================================
-- SECTION 10: Seed Default Org
-- ============================================

INSERT INTO public.organizations (name, slug)
SELECT 'Befree Academy', 'befree-academy'
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations WHERE slug = 'befree-academy'
);

DO $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'befree-academy';

  IF default_org_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT default_org_id, id, 'member'
    FROM auth.users
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = default_org_id AND user_id = auth.users.id
    );
  END IF;
END $$;

-- ============================================
-- SECTION 11: RLS Policies
-- ============================================

-- Profiles Policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Org admins can view member profiles" ON public.profiles;
CREATE POLICY "Org admins can view member profiles" ON public.profiles FOR SELECT USING (
  auth.uid() = id
  OR is_super_admin()
  OR EXISTS (
    SELECT 1 FROM organization_members om1
    INNER JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = profiles.id
      AND om1.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.profiles;
CREATE POLICY "Super Admins can view all profiles" ON public.profiles FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Super Admins can update all profiles" ON public.profiles;
CREATE POLICY "Super Admins can update all profiles" ON public.profiles FOR UPDATE USING (is_super_admin());

-- Organizations Policies
DROP POLICY IF EXISTS "Users can view belonging organizations" ON public.organizations;
CREATE POLICY "Users can view belonging organizations" ON public.organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Owners and Super Admins can update organizations" ON public.organizations;
CREATE POLICY "Owners and Super Admins can update organizations" ON public.organizations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid() AND role = 'owner')
  OR is_super_admin()
);

DROP POLICY IF EXISTS "Super Admins can view all organizations" ON public.organizations;
CREATE POLICY "Super Admins can view all organizations" ON public.organizations FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Super Admins can insert organizations" ON public.organizations;
CREATE POLICY "Super Admins can insert organizations" ON public.organizations FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super Admins can update all organizations" ON public.organizations;
CREATE POLICY "Super Admins can update all organizations" ON public.organizations FOR UPDATE USING (is_super_admin());

DROP POLICY IF EXISTS "Super Admins can delete all organizations" ON public.organizations;
CREATE POLICY "Super Admins can delete all organizations" ON public.organizations FOR DELETE USING (is_super_admin());

-- Organization Members Policies
DROP POLICY IF EXISTS "Users can view org memberships" ON public.organization_members;
CREATE POLICY "Users can view org memberships" ON public.organization_members FOR SELECT USING (
  user_id = auth.uid() OR organization_id = ANY(get_auth_user_org_ids())
);

DROP POLICY IF EXISTS "Authenticated users can insert memberships" ON public.organization_members;
CREATE POLICY "Authenticated users can insert memberships" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super Admins can manage all members" ON public.organization_members;
CREATE POLICY "Super Admins can manage all members" ON public.organization_members FOR ALL USING (is_super_admin());

-- Projects Policies
DROP POLICY IF EXISTS "Users can view org projects" ON public.projects;
CREATE POLICY "Users can view org projects" ON public.projects FOR SELECT USING (organization_id = ANY(get_auth_user_org_ids()));

DROP POLICY IF EXISTS "Users can insert org projects" ON public.projects;
CREATE POLICY "Users can insert org projects" ON public.projects FOR INSERT WITH CHECK (organization_id = ANY(get_auth_user_org_ids()));

DROP POLICY IF EXISTS "Users can update org projects" ON public.projects;
CREATE POLICY "Users can update org projects" ON public.projects FOR UPDATE USING (organization_id = ANY(get_auth_user_org_ids()));

-- Tasks Policies
DROP POLICY IF EXISTS "Users can view tasks of visible projects" ON public.tasks;
CREATE POLICY "Users can view tasks of visible projects" ON public.tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.organization_id = ANY(get_auth_user_org_ids()))
);

DROP POLICY IF EXISTS "Users can create tasks if they satisfy project access" ON public.tasks;
CREATE POLICY "Users can create tasks if they satisfy project access" ON public.tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.organization_id = ANY(get_auth_user_org_ids()))
);

DROP POLICY IF EXISTS "Users can update tasks if they satisfy project access" ON public.tasks;
CREATE POLICY "Users can update tasks if they satisfy project access" ON public.tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.organization_id = ANY(get_auth_user_org_ids()))
);

DROP POLICY IF EXISTS "Users can delete tasks if they satisfy project access" ON public.tasks;
CREATE POLICY "Users can delete tasks if they satisfy project access" ON public.tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.organization_id = ANY(get_auth_user_org_ids()))
);

-- Task Notes Policies
DROP POLICY IF EXISTS "Users can view notes" ON public.task_notes;
CREATE POLICY "Users can view notes" ON public.task_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_notes.task_id AND p.organization_id = ANY(get_auth_user_org_ids()))
);

DROP POLICY IF EXISTS "Users can create notes" ON public.task_notes;
CREATE POLICY "Users can create notes" ON public.task_notes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE t.id = task_notes.task_id AND p.organization_id = ANY(get_auth_user_org_ids()))
);

-- Project Members Policies
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
CREATE POLICY "Users can view project members" ON public.project_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id));

DROP POLICY IF EXISTS "Users can manage members if they access project" ON public.project_members;
CREATE POLICY "Users can manage members if they access project" ON public.project_members FOR ALL USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id));

-- Invitations Policies
DROP POLICY IF EXISTS "Org admins can manage invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can manage invitations" ON public.organization_invitations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = organization_invitations.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "Super admins can view all invitations" ON public.organization_invitations;
CREATE POLICY "Super admins can view all invitations" ON public.organization_invitations FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.organization_invitations;
CREATE POLICY "Anyone can read invitation by token" ON public.organization_invitations FOR SELECT USING (status = 'pending' AND expires_at > NOW());

-- Products & Prices Policies
DROP POLICY IF EXISTS "Allow public read-only access to products" ON public.products;
CREATE POLICY "Allow public read-only access to products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write products" ON public.products;
CREATE POLICY "Admins write products" ON public.products FOR ALL USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "Allow public read-only access to prices" ON public.prices;
CREATE POLICY "Allow public read-only access to prices" ON public.prices FOR SELECT USING (true);

-- Categories Policies
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write categories" ON public.categories;
CREATE POLICY "Admins write categories" ON public.categories FOR ALL USING (public.is_admin_or_owner());

-- Tags Policies
DROP POLICY IF EXISTS "Public read tags" ON public.tags;
CREATE POLICY "Public read tags" ON public.tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write tags" ON public.tags;
CREATE POLICY "Admins write tags" ON public.tags FOR ALL USING (public.is_admin_or_owner());

-- Product Images Policies
DROP POLICY IF EXISTS "Public read product_images" ON public.product_images;
CREATE POLICY "Public read product_images" ON public.product_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write product_images" ON public.product_images;
CREATE POLICY "Admins write product_images" ON public.product_images FOR ALL USING (public.is_admin_or_owner());

-- Product Tags Policies
DROP POLICY IF EXISTS "Public read product_tags" ON public.product_tags;
CREATE POLICY "Public read product_tags" ON public.product_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write product_tags" ON public.product_tags;
CREATE POLICY "Admins write product_tags" ON public.product_tags FOR ALL USING (public.is_admin_or_owner());

-- Orders Policies
DROP POLICY IF EXISTS "Users manage own orders" ON public.orders;
CREATE POLICY "Users manage own orders" ON public.orders FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view org orders" ON public.orders;
CREATE POLICY "Admins view org orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM organization_members WHERE organization_id = orders.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "Admins update org orders" ON public.orders;
CREATE POLICY "Admins update org orders" ON public.orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM organization_members WHERE organization_id = orders.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Order Items Policies
DROP POLICY IF EXISTS "Users manage own order items" ON public.order_items;
CREATE POLICY "Users manage own order items" ON public.order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins view org order items" ON public.order_items;
CREATE POLICY "Admins view org order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders JOIN organization_members ON orders.organization_id = organization_members.organization_id WHERE orders.id = order_items.order_id AND organization_members.user_id = auth.uid() AND organization_members.role IN ('owner', 'admin'))
);

-- Subscriptions Policies
DROP POLICY IF EXISTS "Users can view their organization's subscription" ON public.subscriptions;
CREATE POLICY "Users can view their organization's subscription" ON public.subscriptions FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Super Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Super Admins can view all subscriptions" ON public.subscriptions FOR SELECT USING (public.is_super_admin());

-- Activity Logs Policies
DROP POLICY IF EXISTS "Org members can view activity logs" ON public.activity_logs;
CREATE POLICY "Org members can view activity logs" ON public.activity_logs FOR SELECT USING (
  public.is_super_admin() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = activity_logs.organization_id AND om.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Org members can insert own activity logs" ON public.activity_logs;
CREATE POLICY "Org members can insert own activity logs" ON public.activity_logs FOR INSERT WITH CHECK (
  public.is_super_admin() OR (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = activity_logs.organization_id AND om.user_id = auth.uid()))
);

-- ============================================
-- SECTION 12: Update FK and Populate Data
-- ============================================

-- Fix FK relationship for PostgREST
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Populate slugs for existing data
UPDATE public.projects SET slug = slugify(name) WHERE slug IS NULL;
UPDATE public.tasks SET slug = slugify(title) WHERE slug IS NULL;

-- Handle slug collisions
UPDATE public.projects p SET slug = p.slug || '-' || LEFT(p.id::TEXT, 4) WHERE EXISTS (SELECT 1 FROM public.projects p2 WHERE p2.slug = p.slug AND p2.organization_id = p.organization_id AND p2.id <> p.id) AND slug NOT LIKE '%-%' || LEFT(id::TEXT, 4);
UPDATE public.tasks t SET slug = t.slug || '-' || LEFT(t.id::TEXT, 4) WHERE EXISTS (SELECT 1 FROM public.tasks t2 WHERE t2.slug = t.slug AND t2.project_id = t.project_id AND t2.id <> t.id) AND slug NOT LIKE '%-%' || LEFT(id::TEXT, 4);

-- Add unique constraints for slugs (if not exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_organization_slug_key') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_organization_slug_key UNIQUE (organization_id, slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_project_slug_key') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_slug_key UNIQUE (project_id, slug);
  END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
