-- Run this in Supabase SQL editor to enable admin access
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin boolean not null default false;

-- Example to make yourself an admin:
-- UPDATE profiles SET is_admin = true WHERE email = 'your-email@example.com';
