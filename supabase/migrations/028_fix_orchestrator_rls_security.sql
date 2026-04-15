-- Migration 028: Fix Orchestrator Infrastructure RLS Security
-- Hardens RLS policies on orchestrator tables to match
-- the security patterns established in migrations 020 and 021.
-- All edge functions use service_role (bypasses RLS), so these policies
-- protect against direct REST API access via the anon key.

-- ============================================
-- 1. FIX: Replace open anon insert policies with restricted versions
-- ============================================

DROP POLICY IF EXISTS "Anon insert otel_spans" ON otel_spans;
DROP POLICY IF EXISTS "Anon insert otel_metrics" ON otel_metrics;
DROP POLICY IF EXISTS "Anon insert operation_logs" ON operation_logs;
DROP POLICY IF EXISTS "Anon insert user_sessions" ON user_sessions;

-- Edge functions use service_role which bypasses RLS - no insert policies needed for them

-- ============================================
-- 2. FIX: Remove dangerous anon update on user_sessions
-- ============================================

DROP POLICY IF EXISTS "Anon update user_sessions" ON user_sessions;

-- ============================================
-- 3. FIX: Replace "Admin full access" policies with is_admin()-gated policies
-- ============================================

DROP POLICY IF EXISTS "Admin full access user_sessions" ON user_sessions;
DROP POLICY IF EXISTS "Admin full access user_geolocations" ON user_geolocations;
DROP POLICY IF EXISTS "Admin full access operation_logs" ON operation_logs;
DROP POLICY IF EXISTS "Admin full access otel_spans" ON otel_spans;
DROP POLICY IF EXISTS "Admin full access otel_metrics" ON otel_metrics;
DROP POLICY IF EXISTS "Admin full access edge_function_status" ON edge_function_status;

CREATE POLICY "user_sessions_admin_manage"
  ON user_sessions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "user_geolocations_admin_manage"
  ON user_geolocations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "operation_logs_admin_manage"
  ON operation_logs FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "otel_spans_admin_manage"
  ON otel_spans FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "otel_metrics_admin_manage"
  ON otel_metrics FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "edge_function_status_admin_manage"
  ON edge_function_status FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 4. FIX: Restrict RPC counter function to service_role only
-- ============================================

REVOKE EXECUTE ON FUNCTION increment_edge_function_counters FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_edge_function_counters TO service_role;

-- ============================================
-- 5. ADD: Data retention cleanup function for orchestrator tables
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_orchestrator_data()
RETURNS TABLE (deleted_spans BIGINT, deleted_metrics BIGINT, deleted_op_logs BIGINT, deleted_geolocations BIGINT, ended_sessions BIGINT) AS $$
DECLARE
  span_count BIGINT;
  metric_count BIGINT;
  oplog_count BIGINT;
  geo_count BIGINT;
  session_count BIGINT;
BEGIN
  DELETE FROM otel_spans WHERE start_time < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS span_count = ROW_COUNT;

  DELETE FROM otel_metrics WHERE timestamp < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS metric_count = ROW_COUNT;

  DELETE FROM operation_logs WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS oplog_count = ROW_COUNT;

  DELETE FROM user_geolocations WHERE recorded_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS geo_count = ROW_COUNT;

  DELETE FROM user_sessions WHERE is_active = false AND ended_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS session_count = ROW_COUNT;

  RETURN QUERY SELECT span_count, metric_count, oplog_count, geo_count, session_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service_role can run cleanup
REVOKE EXECUTE ON FUNCTION cleanup_orchestrator_data FROM authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orchestrator_data TO service_role;

-- ============================================
-- 6. ADD: Session token length constraint
-- ============================================

ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS session_token_length_check;
ALTER TABLE user_sessions ADD CONSTRAINT session_token_length_check
  CHECK (session_token IS NULL OR (char_length(session_token) >= 16 AND char_length(session_token) <= 256));
