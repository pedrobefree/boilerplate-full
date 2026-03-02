-- Add 'user_removed' status to organization_invitations
-- This allows tracking when an invited user is later removed from the organization

-- Update the status check constraint to include 'user_removed'
ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_status_check;

ALTER TABLE public.organization_invitations 
ADD CONSTRAINT organization_invitations_status_check 
CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'user_removed'));

-- Add a column to track when the user was removed (optional but useful)
ALTER TABLE public.organization_invitations 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

-- Update the unique constraint to allow multiple 'user_removed' entries
-- (since a user could be invited, removed, invited again, removed again, etc.)
ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_email_status_key;

-- Create a partial unique index that only applies to active statuses
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_active_unique 
ON public.organization_invitations(organization_id, email, status) 
WHERE status IN ('pending', 'accepted');
