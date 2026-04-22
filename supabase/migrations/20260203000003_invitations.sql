-- Create organization_invitations table for pending email invitations
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- Ensure only one pending invite per email per org
    UNIQUE(organization_id, email, status)
);

-- Indexes
CREATE INDEX idx_invitations_token ON public.organization_invitations(token) WHERE status = 'pending';
CREATE INDEX idx_invitations_email ON public.organization_invitations(email) WHERE status = 'pending';
CREATE INDEX idx_invitations_org ON public.organization_invitations(organization_id);

-- RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Admins and owners of the org can manage invitations
CREATE POLICY "Org admins can manage invitations" ON public.organization_invitations
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_invitations.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

-- Super admins can view all invitations
CREATE POLICY "Super admins can view all invitations" ON public.organization_invitations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
    )
);

-- Allow public read of invitation by token (for signup flow)
CREATE POLICY "Anyone can read invitation by token" ON public.organization_invitations
FOR SELECT USING (
    status = 'pending' 
    AND expires_at > NOW()
);

-- Function to accept an invitation
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
    
    -- Get the invitation
    SELECT * INTO invitation
    FROM organization_invitations
    WHERE token = invite_token
    AND status = 'pending'
    AND expires_at > NOW();
    
    IF invitation IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invitation not found or expired');
    END IF;
    
    -- Verify email matches
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = current_user_id 
        AND email = invitation.email
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Email does not match invitation');
    END IF;
    
    -- Check if already a member
    IF EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = invitation.organization_id
        AND user_id = current_user_id
    ) THEN
        -- Update invitation as accepted anyway
        UPDATE organization_invitations 
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = invitation.id;
        
        RETURN json_build_object('success', true, 'message', 'Already a member');
    END IF;
    
    -- Add user to organization
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (invitation.organization_id, current_user_id, invitation.role);
    
    -- Mark invitation as accepted
    UPDATE organization_invitations 
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = invitation.id;
    
    RETURN json_build_object(
        'success', true, 
        'organization_id', invitation.organization_id,
        'role', invitation.role
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
