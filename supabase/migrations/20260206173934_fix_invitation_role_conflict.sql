-- Fix: Auto-join trigger should not override invitation roles
-- This migration updates the auto_join_default_org trigger to skip auto-joining
-- when a user has a pending invitation, allowing the invitation acceptance to set the correct role.

CREATE OR REPLACE FUNCTION public.auto_join_default_org()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id UUID;
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
    -- The invitation acceptance will handle adding them with the correct role
    IF has_pending_invite THEN
        RETURN NEW;
    END IF;
    
    -- Otherwise, proceed with auto-join to default org
    SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'befree-academy';
    
    IF default_org_id IS NOT NULL THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (default_org_id, NEW.id, 'member')
        ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger is already created in previous migration, no need to recreate
