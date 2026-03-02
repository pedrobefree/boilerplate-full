-- Secure function to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the user has the 'super_admin' role in the profiles table
  -- We use a direct query to avoid recursion if RLS were to use this function on profiles
  -- But since this is SECURITY DEFINER, it bypasses RLS for the query inside.
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Policies for Organizations
CREATE POLICY "Super Admins can view all organizations" 
ON public.organizations FOR SELECT 
USING (is_super_admin());

CREATE POLICY "Super Admins can insert organizations" 
ON public.organizations FOR INSERT 
WITH CHECK (is_super_admin());

CREATE POLICY "Super Admins can update all organizations" 
ON public.organizations FOR UPDATE 
USING (is_super_admin());

CREATE POLICY "Super Admins can delete all organizations" 
ON public.organizations FOR DELETE 
USING (is_super_admin());

-- Update Policies for Members
CREATE POLICY "Super Admins can manage all members" 
ON public.organization_members FOR ALL 
USING (is_super_admin());

-- Update Policies for Profiles
CREATE POLICY "Super Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (is_super_admin());

CREATE POLICY "Super Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (is_super_admin());
