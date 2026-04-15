-- Migration 024: Create rate_limits table for distributed rate limiting
-- This replaces in-memory Map-based rate limiting which is ineffective in serverless
-- environments where each invocation runs in a separate isolate.

-- Only create table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limits') THEN
        CREATE TABLE rate_limits (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            key TEXT NOT NULL,           -- e.g., "ip:192.168.1.1:admin-auth:post"
            count INTEGER NOT NULL DEFAULT 1,
            window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            window_duration_seconds INTEGER NOT NULL DEFAULT 60,
            max_count INTEGER NOT NULL DEFAULT 100,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    END IF;
END $$;

-- Create unique index only if it doesn't exist (avoid error on duplicate)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rate_limits_key'
    ) THEN
        -- Check if column 'key' exists before creating index
        IF EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name = 'rate_limits' AND column_name = 'key'
        ) THEN
            CREATE UNIQUE INDEX idx_rate_limits_key ON rate_limits (key);
        END IF;
    END IF;
END $$;

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No read/write access from client side - only service role can manage rate limits
-- This table is exclusively managed by edge functions using SUPABASE_SERVICE_ROLE_KEY

-- Function to check and increment rate limit (atomic upsert)
-- Returns TRUE if request is allowed, FALSE if rate limit exceeded
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_max_count INTEGER DEFAULT 100,
    p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_window_start TIMESTAMPTZ;
    v_count INTEGER;
BEGIN
    -- Calculate the current window start
    v_window_start := v_now - (p_window_seconds || ' seconds')::INTERVAL;

    -- Try to insert or update atomically
    INSERT INTO rate_limits (key, count, window_start, window_duration_seconds, max_count, updated_at)
    VALUES (p_key, 1, v_now, p_window_seconds, p_max_count, v_now)
    ON CONFLICT (key) DO UPDATE
    SET 
        count = CASE 
            WHEN rate_limits.window_start < v_window_start THEN 1  -- Reset if window expired
            ELSE rate_limits.count + 1
        END,
        window_start = CASE 
            WHEN rate_limits.window_start < v_window_start THEN v_now  -- Reset window
            ELSE rate_limits.window_start
        END,
        max_count = p_max_count,
        window_duration_seconds = p_window_seconds,
        updated_at = v_now
    RETURNING count, window_start INTO v_count, v_window_start;

    -- Return true if under limit
    RETURN v_count <= p_max_count AND v_window_start >= v_window_start;
END;
$$;

-- Function to cleanup expired rate limit entries (call periodically or via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM rate_limits
        WHERE window_start < NOW() - (window_duration_seconds || ' seconds')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    RETURN v_count;
END;
$$;

-- Only add comments if they don't already exist (avoid duplicate function signature error)
DO $$
BEGIN
    -- Check if function signature is unique before adding comment
    IF (SELECT COUNT(*) FROM pg_proc WHERE proname = 'check_rate_limit') = 1 THEN
        COMMENT ON FUNCTION check_rate_limit IS 'Atomically checks and increments rate limit. Returns true if allowed.';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_proc WHERE proname = 'cleanup_expired_rate_limits') = 1 THEN
        COMMENT ON FUNCTION cleanup_expired_rate_limits IS 'Removes expired rate limit entries. Returns count of deleted rows.';
    END IF;
END $$;
