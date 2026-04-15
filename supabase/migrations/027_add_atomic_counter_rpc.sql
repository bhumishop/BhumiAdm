-- Migration 027: Add RPC function for atomic counter increments
-- This replaces the unsupported supabase.raw() pattern in edge functions

-- Function to atomically increment counters on edge_function_status
CREATE OR REPLACE FUNCTION increment_edge_function_counters(
  p_function_name TEXT,
  p_increment_total INT DEFAULT 0,
  p_increment_success INT DEFAULT 0,
  p_increment_error INT DEFAULT 0,
  p_last_status TEXT DEFAULT NULL,
  p_last_error TEXT DEFAULT NULL,
  p_last_execution TIMESTAMPTZ DEFAULT NULL,
  p_avg_duration_ms NUMERIC DEFAULT NULL,
  p_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE edge_function_status
  SET
    total_calls = total_calls + p_increment_total,
    success_calls = success_calls + p_increment_success,
    error_calls = error_calls + p_increment_error,
    last_status = COALESCE(p_last_status, last_status),
    last_error = COALESCE(p_last_error, last_error),
    last_execution = COALESCE(p_last_execution, last_execution),
    avg_duration_ms = COALESCE(p_avg_duration_ms, avg_duration_ms),
    updated_at = COALESCE(p_updated_at, updated_at)
  WHERE function_name = p_function_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION increment_edge_function_counters TO authenticated;
GRANT EXECUTE ON FUNCTION increment_edge_function_counters TO service_role;
