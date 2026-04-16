-- Migration: 035_add_admin_uuid_and_email_verification
-- Description: Add admin_uuid column for UUID-based admin identification
-- Replaces google_sub as the primary identifier with email-based allowlist

-- Add admin_uuid column (UUID, auto-generated)
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS admin_uuid UUID DEFAULT gen_random_uuid();

-- Make admin_uuid NOT NULL and UNIQUE once all existing rows have values
-- (For existing admins, the default gen_random_uuid() will populate it)
UPDATE admin_users SET admin_uuid = gen_random_uuid() WHERE admin_uuid IS NULL;
ALTER TABLE admin_users ALTER COLUMN admin_uuid SET NOT NULL;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_admin_uuid_unique UNIQUE (admin_uuid);

-- Create index for UUID lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_uuid ON admin_users(admin_uuid);

-- Email index already exists from migration 018, but let's ensure it's there
CREATE INDEX IF NOT EXISTS idx_admin_users_email_lookup ON admin_users(email);

-- Update the unique constraint to allow email-based lookup
-- The google_sub remains for identity verification but email is the access control key
CREATE INDEX IF NOT EXISTS idx_admin_users_email_lower ON admin_users(LOWER(email));
