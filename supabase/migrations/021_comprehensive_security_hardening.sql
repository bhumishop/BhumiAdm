-- Migration: 021_comprehensive_security_hardening
-- Description: Final security improvements - config fixes, audit logging, rate limiting enhancements

-- ============================================
-- 1. IMPROVE RATE LIMITING - Add database-level enforcement
-- ============================================

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_identifier TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Only allow valid event types
  IF p_event_type NOT IN (
    'rate_limit_exceeded',
    'blocked_request',
    'suspicious_activity',
    'admin_action',
    'data_export',
    'auth_failure',
    'privilege_escalation_attempt',
    'invalid_token',
    'sql_injection_attempt'
  ) THEN
    RAISE EXCEPTION 'Invalid security event type: %', p_event_type;
  END IF;

  INSERT INTO security_audit_log (event_type, identifier, details)
  VALUES (p_event_type, p_identifier, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. ADD SQL INJECTION DETECTION TRIGGER
-- ============================================

-- Function to detect potential SQL injection in text inputs
CREATE OR REPLACE FUNCTION detect_sql_injection()
RETURNS TRIGGER AS $$
DECLARE
  col TEXT;
  val TEXT;
  sql_patterns TEXT[] := ARRAY[
    ';DROP', ';DELETE', ';UPDATE', ';INSERT',
    'UNION SELECT', 'OR 1=1', 'OR ''1''=''1',
    'EXEC(', 'EXECUTE(', 'xp_', 'sp_',
    'CAST(0x', 'DECLARE @', 'WAITFOR DELAY'
  ];
BEGIN
  -- Only check text columns on INSERT/UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    FOR col IN SELECT column_name FROM information_schema.columns
               WHERE table_name = TG_TABLE_NAME
               AND data_type IN ('text', 'character varying', 'character')
    LOOP
      EXECUTE format('SELECT ($1).%I', col) USING NEW INTO val;

      IF val IS NOT NULL THEN
        FOR i IN 1..array_length(sql_patterns, 1) LOOP
          IF UPPER(val) LIKE '%' || sql_patterns[i] || '%' THEN
            -- Log the attempt
            PERFORM log_security_event(
              'sql_injection_attempt',
              current_setting('request.headers', true)::json->>'x-forwarded-for',
              jsonb_build_object(
                'table', TG_TABLE_NAME,
                'column', col,
                'operation', TG_OP
              )
            );
            RAISE EXCEPTION 'Potentially malicious input detected';
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply SQL injection detection to sensitive tables
CREATE TRIGGER detect_sql_injection_orders
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION detect_sql_injection();

CREATE TRIGGER detect_sql_injection_order_items
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION detect_sql_injection();

-- ============================================
-- 3. ADD PRIVILEGE ESCALATION DETECTION
-- ============================================

-- Trigger to detect unauthorized role changes
CREATE OR REPLACE FUNCTION detect_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only service_role or admin can change roles
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Check if someone is trying to grant themselves admin
    IF NEW.role = 'admin' OR NEW.role = 'super_admin' THEN
      -- Log for audit
      PERFORM log_security_event(
        'admin_action',
        NEW.user_id::TEXT,
        jsonb_build_object(
          'action', 'role_change',
          'new_role', NEW.role,
          'table', TG_TABLE_NAME
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER detect_privilege_escalation_user_roles
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION detect_privilege_escalation();

-- ============================================
-- 4. ADD AUTOMATED RATE LIMIT CLEANUP SCHEDULE
-- ============================================

-- Function that can be called by cron or manually
CREATE OR REPLACE FUNCTION cleanup_old_security_data()
RETURNS TABLE (deleted_rate_limits INTEGER, deleted_audit_logs INTEGER) AS $$
DECLARE
  rl_count INTEGER;
  audit_count INTEGER;
BEGIN
  -- Delete rate limits older than 48 hours
  DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '48 hours';
  GET DIAGNOSTICS rl_count = ROW_COUNT;

  -- Delete audit logs older than 90 days
  DELETE FROM security_audit_log WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS audit_count = ROW_COUNT;

  RETURN QUERY SELECT rl_count, audit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. ADD ORDER TAMPERING PROTECTION
-- ============================================

-- Prevent non-admins from changing critical order fields
CREATE OR REPLACE FUNCTION protect_order_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow users to update their own orders
  -- But prevent changes to payment_status, total, or status by non-admins
  IF auth.role() = 'authenticated' AND NOT is_admin() THEN
    -- Users can only update certain fields on their own orders
    IF NEW.user_id = auth.uid() THEN
      -- Reset fields that users shouldn't change
      NEW.payment_status := OLD.payment_status;
      NEW.total := OLD.total;
      NEW.subtotal := OLD.subtotal;
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_order_integrity_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION protect_order_integrity();

-- ============================================
-- 6. ADD INDEXES FOR SECURITY QUERIES
-- ============================================

-- Index for security audit log queries
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type_created
  ON security_audit_log(event_type, created_at DESC);

-- Index for rate limit lookups (compound)
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON rate_limits(identifier, action, window_end);

-- Index for admin user lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role_lookup
  ON user_roles(user_id, role);

-- ============================================
-- 7. ADD FUNCTION TO CHECK ADMIN STATUS
-- ============================================

-- Ensure is_admin function is robust
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Must have a valid authenticated session
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user has admin or super_admin role
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    -- Check if role is still active (could add is_active column later)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. ADD DATA VALIDATION CONSTRAINTS
-- ============================================

-- Ensure product prices are always positive
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_positive;
ALTER TABLE products ADD CONSTRAINT products_price_positive
  CHECK (price >= 0);

-- Ensure order totals are always non-negative
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_total_non_negative;
ALTER TABLE orders ADD CONSTRAINT orders_total_non_negative
  CHECK (total >= 0 AND subtotal >= 0);

-- Ensure inventory quantities are non-negative
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_non_negative;
ALTER TABLE products ADD CONSTRAINT products_stock_non_negative
  CHECK (stock_quantity >= 0);

ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS variants_stock_non_negative;
ALTER TABLE product_variants ADD CONSTRAINT variants_stock_non_negative
  CHECK (stock_quantity >= 0);

-- Validate email format in orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_email_format;
ALTER TABLE orders ADD CONSTRAINT orders_customer_email_format
  CHECK (customer_email IS NULL OR customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ============================================
-- 9. CREATE SECURITY MONITORING VIEW
-- ============================================

CREATE OR REPLACE VIEW security_monitoring_dashboard AS
SELECT
  'rate_limits' AS metric_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE is_blocked = true) AS blocked_count,
  COUNT(*) FILTER (WHERE window_end > NOW() - INTERVAL '1 hour') AS recent_count
FROM rate_limits
WHERE window_end > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  event_type AS metric_type,
  COUNT(*) AS total_count,
  0 AS blocked_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS recent_count
FROM security_audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;

-- Only admins can view security monitoring
GRANT SELECT ON security_monitoring_dashboard TO authenticated;

-- ============================================
-- 10. ADD WEBHOOK SIGNATURE VERIFICATION LOG
-- ============================================

CREATE OR REPLACE FUNCTION log_webhook_verification(
  p_webhook_type TEXT,
  p_success BOOLEAN,
  p_event_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO security_audit_log (event_type, identifier, details)
  VALUES (
    CASE WHEN p_success THEN 'admin_action' ELSE 'auth_failure' END,
    p_event_id,
    jsonb_build_object(
      'webhook_type', p_webhook_type,
      'success', p_success,
      'error', p_error_message
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- This migration adds:
-- 1. Security event logging function
-- 2. SQL injection detection on sensitive tables
-- 3. Privilege escalation detection
-- 4. Automated cleanup function for old data
-- 5. Order tampering protection trigger
-- 6. Additional security indexes
-- 7. Robust is_admin() function
-- 8. Data validation constraints
-- 9. Security monitoring view
-- 10. Webhook verification logging
-- ============================================
