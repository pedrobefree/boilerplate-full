-- 1. Fix Missing Relationship for PostgREST (Failed to load members)
-- We need a direct FK to profiles for easy embedding like select=*,profiles(*)
ALTER TABLE organization_members
DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;

ALTER TABLE organization_members
ADD CONSTRAINT organization_members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. Allow Super Admins to Create Organizations (Fix Privilege Error)
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (
    -- User is the owner
    auth.uid() = owner_id
    OR
    -- OR User is a Super Admin (Global Permission)
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
    )
);

-- 3. Reload Schema Cache to apply changes immediately
NOTIFY pgrst, 'reload schema';
