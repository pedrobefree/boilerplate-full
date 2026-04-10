-- Update organization_members to allow multiple roles per user in the same organization
-- Requirement: User can be both 'Admin' and 'Customer' simultaneously.

-- 1. Drop the old constraint that limited one role per user
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_key;

-- 2. Add a new constraint that allows multiple roles but prevents duplicate roles for the same user
-- This satisfies the rule: a user can have several entries in organization_members if they have different roles.
ALTER TABLE public.organization_members 
ADD CONSTRAINT organization_members_org_user_role_unique UNIQUE (organization_id, user_id, role);

-- 3. Update the trigger function to be metadata-aware
-- If the user was just created, we check if a role was specified in raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.auto_join_default_org()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id UUID;
    target_role TEXT;
BEGIN
    SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'befree-academy';
    
    -- Pick role from metadata or default to 'member'
    target_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');
    
    IF default_org_id IS NOT NULL THEN
        -- Link the user to the organization with the target role
        -- We use ON CONFLICT DO NOTHING in case the role was already assigned somehow
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (default_org_id, NEW.id, target_role)
        ON CONFLICT (organization_id, user_id, role) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
