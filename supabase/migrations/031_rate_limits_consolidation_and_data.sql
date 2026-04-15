-- Migration 031: Rate Limits Consolidation, Collection Name Fix, Livros Subcollection
-- ============================================
-- 1. CONSOLIDATE rate_limits schema
-- ============================================
-- Migration 011 created rate_limits with columns: identifier, action, request_count, window_start, window_end, is_blocked, ...
-- Migration 024 tried to create rate_limits with columns: key, count, window_start, window_duration_seconds, max_count
-- Since 011 ran first, 024's table was skipped. The check_rate_limit function uses 'key' column which doesn't exist.
-- This migration adds the missing columns to the 011 schema to make check_rate_limit work.

-- Add missing columns to rate_limits if they don't exist
DO $$
BEGIN
  -- Add 'key' column if missing (used by check_rate_limit function from migration 024)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'key'
  ) THEN
    ALTER TABLE rate_limits ADD COLUMN key TEXT;
  END IF;

  -- Add 'window_duration_seconds' column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'window_duration_seconds'
  ) THEN
    ALTER TABLE rate_limits ADD COLUMN window_duration_seconds INTEGER DEFAULT 60;
  END IF;

  -- Add 'max_count' column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'max_count'
  ) THEN
    ALTER TABLE rate_limits ADD COLUMN max_count INTEGER DEFAULT 100;
  END IF;

  -- Add 'updated_at' column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE rate_limits ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Rename 'request_count' to 'count' if 'count' doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'count'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'request_count'
  ) THEN
    ALTER TABLE rate_limits RENAME COLUMN request_count TO count;
  END IF;
END $$;

-- Create or replace check_rate_limit to work with consolidated schema
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_count INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_key TEXT;
BEGIN
  -- Build composite key from identifier + action if needed
  v_key := p_key;

  -- Calculate the current window start
  v_window_start := v_now - (p_window_seconds || ' seconds')::INTERVAL;

  -- Try to insert or update atomically using the identifier/action columns
  INSERT INTO rate_limits (key, count, window_start, window_duration_seconds, max_count, updated_at)
  VALUES (v_key, 1, v_now, p_window_seconds, p_max_count, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limits.window_start < v_window_start THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < v_window_start THEN v_now
      ELSE rate_limits.window_start
    END,
    max_count = p_max_count,
    window_duration_seconds = p_window_seconds,
    updated_at = v_now
  RETURNING count, window_start INTO v_count, v_window_start;

  -- Return true if under limit
  RETURN v_count <= p_max_count;
END;
$$;

-- Create unique index on key if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key) WHERE key IS NOT NULL;

-- ============================================
-- 2. FIX: Update collection name from BhumiPrint to BhumisPrint
-- ============================================

UPDATE collections
SET name = 'BhumisPrint',
    description = 'Print on demand products by Bhumis',
    updated_at = NOW()
WHERE slug = 'bhumi-print';

-- ============================================
-- 3. ADD: Livros subcollection to BhumisPrint collection
-- ============================================

INSERT INTO subcollections (collection_id, slug, name, description, icon, fulfillment_type, sort_order)
SELECT
  c.id,
  'livros',
  'Livros',
  'Books and publications',
  '📚',
  'own-stock',
  4
FROM collections c WHERE c.slug = 'bhumi-print'
ON CONFLICT (slug) DO NOTHING;
