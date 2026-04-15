-- Migration 033: Fix rate_limits unique constraint for ON CONFLICT
-- The insert_rate_limit_entry RPC function uses ON CONFLICT (key) DO UPDATE
-- but the partial index (WHERE key IS NOT NULL) doesn't satisfy the ON CONFLICT requirement.
-- We need a full unique index or unique constraint on the key column.

-- Drop the partial index first
DROP INDEX IF EXISTS idx_rate_limits_key;

-- Create a proper unique constraint on key column
-- This allows ON CONFLICT (key) to work correctly
ALTER TABLE rate_limits ADD CONSTRAINT uq_rate_limits_key UNIQUE (key);
