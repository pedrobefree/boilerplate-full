-- Allow organization admins and owners to view profiles of members in their organization
-- This fixes the issue where admins see "Unknown" for other members' names and emails

CREATE POLICY "Org admins can view member profiles"
ON profiles
FOR SELECT
USING (
  -- Users can always view their own profile
  auth.uid() = id
  OR
  -- Super admins can view all profiles
  is_super_admin()
  OR
  -- Org admins/owners can view profiles of users in their organization
  EXISTS (
    SELECT 1 FROM organization_members om1
    INNER JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = profiles.id
      AND om1.role IN ('owner', 'admin')
  )
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
