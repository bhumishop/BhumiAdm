-- Migration: 018_create_admin_users_table
-- Description: Creates admin_users table for Google OAuth admin authentication
-- Replaces deprecated user_roles table

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- No anon access - only service_role can manage
CREATE POLICY "Service role can manage admin users"
  ON admin_users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_admin_users_google_sub ON admin_users(google_sub);
CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Trigger for updated_at
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
