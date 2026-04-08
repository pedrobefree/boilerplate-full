-- Add address and phone fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update organization_members role check to include 'customer'
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE public.organization_members 
ADD CONSTRAINT organization_members_role_check 
CHECK (role IN ('owner', 'admin', 'member', 'customer'));

-- Add magic_link to orders for temporary onboarding
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS magic_link TEXT;
