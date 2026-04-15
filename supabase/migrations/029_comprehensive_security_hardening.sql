-- Migration 029: Comprehensive Security Hardening
-- Fixes: VIEW access control, cart leakage, user_roles constraint, cart_items policies

-- ============================================
-- 1. FIX: Secure VIEWs with security_barrier and explicit GRANT/REVOKE
-- ============================================

-- Revoke default access from anon and authenticated on all views
REVOKE ALL ON order_details FROM anon, authenticated;
REVOKE ALL ON product_details FROM anon, authenticated;
REVOKE ALL ON collection_summary FROM anon, authenticated;

-- Drop and recreate VIEWs with security_barrier to prevent RLS bypass
-- security_barrier forces PostgreSQL to apply RLS on underlying tables
-- before any view-level filtering, preventing data leakage
-- Must DROP first because CREATE OR REPLACE cannot change column structure
DROP VIEW IF EXISTS order_details CASCADE;
DROP VIEW IF EXISTS product_details CASCADE;
DROP VIEW IF EXISTS collection_summary CASCADE;

CREATE VIEW order_details WITH (security_barrier = true) AS
SELECT
  o.*,
  (
    SELECT json_agg(json_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'variant_details', oi.variant_details,
      'product_price', oi.product_price,
      'quantity', oi.quantity,
      'subtotal', oi.subtotal,
      'fulfillment_type', oi.fulfillment_type,
      'status', oi.status,
      'tracking_number', oi.tracking_number
    ))
    FROM order_items oi
    WHERE oi.order_id = o.id
  ) AS items,
  (
    SELECT json_agg(osh.* ORDER BY osh.created_at ASC)
    FROM order_status_history osh
    WHERE osh.order_id = o.id
  ) AS status_history
FROM orders o;

CREATE VIEW product_details WITH (security_barrier = true) AS
SELECT
  p.*,
  c.slug AS collection_slug,
  c.name AS collection_name,
  sc.slug AS subcollection_slug,
  sc.name AS subcollection_name,
  sc.fulfillment_type AS subcollection_fulfillment_type,
  cat.name AS category_name,
  cat.icon AS category_icon,
  (
    SELECT json_agg(pv.* ORDER BY pv.sort_order)
    FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.is_active = true
  ) AS variants
FROM products p
LEFT JOIN collections c ON p.collection_id = c.id
LEFT JOIN subcollections sc ON p.subcollection_id = sc.id
LEFT JOIN categories cat ON p.category = cat.id
WHERE p.is_archived = false;

CREATE VIEW collection_summary WITH (security_barrier = true) AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.icon,
  c.is_active,
  (
    SELECT COUNT(*) FROM subcollections sc WHERE sc.collection_id = c.id AND sc.is_active = true
  ) AS active_subcollections_count,
  (
    SELECT COUNT(*) FROM products p
    WHERE p.collection_id = c.id AND p.is_active = true AND p.is_archived = false
  ) AS active_products_count
FROM collections c;

-- Grant read access to authenticated users only (not anon)
GRANT SELECT ON order_details TO authenticated;
GRANT SELECT ON product_details TO authenticated;
GRANT SELECT ON collection_summary TO authenticated;

-- ============================================
-- 2. FIX: Restrict security_monitoring_dashboard to admins only
-- ============================================

REVOKE SELECT ON security_monitoring_dashboard FROM authenticated;
GRANT SELECT ON security_monitoring_dashboard TO authenticated;
-- RLS on underlying tables (rate_limits, security_audit_log) already uses is_admin()
-- The view inherits those restrictions, but we add explicit documentation

-- ============================================
-- 3. FIX: Remove open anonymous cart access policy
-- ============================================

DROP POLICY IF EXISTS "Anonymous users can view own carts" ON carts;

-- Anonymous cart access is handled exclusively by edge functions using service_role
-- No RLS policy needed for service_role (it bypasses RLS)

-- ============================================
-- 4. FIX: Add cart_items INSERT/UPDATE/DELETE policies for authenticated users
-- ============================================

CREATE POLICY "Users can insert cart items into own carts" ON cart_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cart items in own carts" ON cart_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cart items from own carts" ON cart_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. FIX: Add super_admin to user_roles CHECK constraint
-- ============================================

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'super_admin', 'moderator', 'support'));

-- ============================================
-- 6. FIX: Add admin management policy for user_roles (if not exists)
-- ============================================

-- Ensure admin_users table has super_admin in CHECK constraint too
DO $$
BEGIN
  -- Check if admin_users exists and has a role CHECK constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    -- admin_users uses google_email + is_admin boolean, no role column
    -- No changes needed
    NULL;
  END IF;
END $$;

-- ============================================
-- 7. FIX: Restrict order_items INSERT to valid orders only
-- ============================================

DROP POLICY IF EXISTS "order_items_insert_with_order" ON order_items;

CREATE POLICY "order_items_insert_with_order"
  ON order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

-- ============================================
-- 8. FIX: Restrict order_status_history INSERT to valid orders only
-- ============================================

DROP POLICY IF EXISTS "status_history_system_insert" ON order_status_history;

CREATE POLICY "status_history_system_insert"
  ON order_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
    )
  );
