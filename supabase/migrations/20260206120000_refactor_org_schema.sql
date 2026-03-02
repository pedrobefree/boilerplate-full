-- 1. Drop policies that depend on owner_id FIRST
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;
-- Also drop the super admin update policy if it exists (for safety re-runs)
DROP POLICY IF EXISTS "Owners and Super Admins can update organizations" ON public.organizations;


-- 2. Add missing invite_expiration_days column
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS invite_expiration_days INTEGER DEFAULT 7;


-- 3. Drop unused/redundant columns
-- owner_id is redundant (we use organization_members)
-- billing/payment are unused legacy attributes
ALTER TABLE organizations
DROP COLUMN IF EXISTS owner_id,
DROP COLUMN IF EXISTS billing_address,
DROP COLUMN IF EXISTS payment_method;


-- 4. Re-create RLS Policies

-- Allow authenticated users to create organizations
-- (Previously enforced owner_id check, now we rely on the subsequent logic to add them as owner)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow Owners (via members table) and Super Admins to update settings
CREATE POLICY "Owners and Super Admins can update organizations"
ON public.organizations FOR UPDATE
TO authenticated
USING (
    -- Check if user is an owner of this organization
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = public.organizations.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
    OR
    -- Check if user is a Super Admin
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
    )
);

-- Reload schema
NOTIFY pgrst, 'reload schema';
