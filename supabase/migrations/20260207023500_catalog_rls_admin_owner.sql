-- Update RLS policies for catalog tables to allow admins and owners
-- Tags, Categories, and Products should be manageable by admins and owners, not just super_admins

-- Helper function to check if user is admin or owner in their organization
create or replace function public.is_admin_or_owner()
returns boolean
language plpgsql
security definer
as $$
declare
  user_role text;
begin
  -- Check if user is super admin first
  if public.is_super_admin() then
    return true;
  end if;
  
  -- Check if user is admin or owner in any organization
  select om.role into user_role
  from organization_members om
  where om.user_id = auth.uid()
  and om.role in ('admin', 'owner')
  limit 1;
  
  return user_role is not null;
end;
$$;

-- Update tags RLS policy
drop policy if exists "Admins write tags" on tags;
create policy "Admins write tags" on tags for all using (public.is_admin_or_owner());

-- Update categories RLS policy  
drop policy if exists "Admins write categories" on categories;
create policy "Admins write categories" on categories for all using (public.is_admin_or_owner());

-- Update products RLS policy
drop policy if exists "Admins write products" on products;
create policy "Admins write products" on products for all using (public.is_admin_or_owner());

-- Update product_tags RLS policy
drop policy if exists "Admins write product_tags" on product_tags;
create policy "Admins write product_tags" on product_tags for all using (public.is_admin_or_owner());
