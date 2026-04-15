-- Migration 025: Create umapenca_prefill_logs table for audit tracking
-- Run this in Supabase Dashboard > SQL Editor
-- This table logs all pre-fill token generations for UmaPenca registration

CREATE TABLE IF NOT EXISTS umapenca_prefill_logs (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_country VARCHAR(2) DEFAULT 'BR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ref TEXT DEFAULT 'bhumi-shop',
  token_jti UUID
);

-- Indexes for fast lookup and audit
CREATE INDEX IF NOT EXISTS idx_umapenca_prefill_logs_email ON umapenca_prefill_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_umapenca_prefill_logs_created ON umapenca_prefill_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_umapenca_prefill_logs_country ON umapenca_prefill_logs(user_country);

-- Enable RLS
ALTER TABLE umapenca_prefill_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (edge functions)
-- No client-side access to this table

COMMENT ON TABLE umapenca_prefill_logs IS 'Audit log for UmaPenca pre-fill token generation';

-- Verify creation
SELECT 'Migration 025 completed successfully' AS status;
SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'public';
