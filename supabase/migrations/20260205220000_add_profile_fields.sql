-- Migration to add profile fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
