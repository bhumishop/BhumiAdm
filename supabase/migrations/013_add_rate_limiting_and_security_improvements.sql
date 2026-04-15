-- Migration: 013_add_rate_limiting_and_security_improvements
-- Description: Adds rate limiting indexes and security hardening functions
-- NOTE: rate_limits and security_audit_log tables are created in 011

-- ============================================
-- Add indexes for rate_limits table (created in 011)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_action ON rate_limits(action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(is_blocked) WHERE is_blocked = true;

-- ============================================
-- Add indexes for security_audit_log table (created in 011)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at DESC);

-- Cleanup old rate limit entries (older than 24h)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Rate limit checking function
-- ============================================
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  current_record RECORD;
  window_end_time TIMESTAMPTZ;
BEGIN
  window_end_time := NOW() + (p_window_minutes || ' minutes')::INTERVAL;

  -- Check if currently blocked
  SELECT * INTO current_record
  FROM rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND is_blocked = true;

  IF FOUND THEN
    IF current_record.blocked_until IS NOT NULL AND current_record.blocked_until > NOW() THEN
      RETURN false; -- Still blocked
    ELSE
      -- Unblock expired block
      UPDATE rate_limits
      SET is_blocked = false, blocked_until = NULL, request_count = 0, window_start = NOW()
      WHERE identifier = p_identifier AND action = p_action;
    END IF;
  END IF;

  -- Update or insert rate limit record
  INSERT INTO rate_limits (identifier, action, request_count, window_start, window_end)
  VALUES (p_identifier, p_action, 1, NOW(), window_end_time)
  ON CONFLICT (identifier, action) DO UPDATE
  SET request_count = rate_limits.request_count + 1
  RETURNING * INTO current_record;

  -- Check if exceeded limit
  IF current_record.request_count > p_max_requests THEN
    UPDATE rate_limits
    SET is_blocked = true,
        blocked_until = NOW() + INTERVAL '1 hour',
        block_reason = 'Rate limit exceeded: ' || p_max_requests || ' requests per ' || p_window_minutes || ' minutes'
    WHERE identifier = p_identifier AND action = p_action;
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Fix for product_analytics: Add rate limit trigger
-- ============================================
CREATE OR REPLACE FUNCTION check_analytics_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  client_identifier TEXT;
BEGIN
  -- Use session_id or IP as identifier
  client_identifier := COALESCE(NEW.session_id, current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown');

  -- Rate limit: 500 events per hour per session/IP
  IF NOT check_rate_limit(client_identifier, 'product_analytics', 500, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded for analytics events';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_analytics_rate_limit_trigger
  BEFORE INSERT ON product_analytics
  FOR EACH ROW
  EXECUTE FUNCTION check_analytics_rate_limit();

-- ============================================
-- Function to safely get client IP from request context
-- ============================================
CREATE OR REPLACE FUNCTION get_client_ip()
RETURNS TEXT AS $$
BEGIN
  -- Try to get from request headers (set by Supabase edge functions or proxy)
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    '0.0.0.0'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Audit log for security events (table created in 011, add indexes here)
-- Already indexed above
-- ============================================
