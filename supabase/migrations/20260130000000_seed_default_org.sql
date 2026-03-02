-- Migration: Seed Default Organization and Auto-Join Logic
-- Description: Creates 'Befree Academy' organization and ensures all users (current and future) are members.

-- 1. Create the default organization if it doesn't exist
INSERT INTO public.organizations (name, slug)
SELECT 'Befree Academy', 'befree-academy'
WHERE NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = 'befree-academy'
);

-- 2. Function to add all existing users to the default organization
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'befree-academy';

    IF default_org_id IS NOT NULL THEN
        -- Insert missing memberships for all current users
        INSERT INTO public.organization_members (organization_id, user_id, role)
        SELECT default_org_id, id, 'member'
        FROM auth.users
        WHERE NOT EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE organization_id = default_org_id AND user_id = auth.users.id
        );
    END IF;
END $$;

-- 3. Trigger to automatically add NEW users to the default organization
CREATE OR REPLACE FUNCTION public.auto_join_default_org()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id UUID;
BEGIN
    SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'befree-academy';
    
    IF default_org_id IS NOT NULL THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (default_org_id, NEW.id, 'member')
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_join_org ON auth.users;
CREATE TRIGGER on_auth_user_created_join_org
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_join_default_org();
