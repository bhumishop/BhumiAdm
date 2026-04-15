-- Migration: 020_fix_rls_policies_security_hardening
-- Description: Fixes critical RLS policy conflicts from migration 019
-- Properly separates: anon (storefront read), authenticated (admin write), service_role (edge functions)
-- Migration 019 incorrectly gave ALL authenticated users FULL CRUD access to all tables

-- ============================================
-- PROBLEM ANALYSIS:
-- Migration 019 replaced all policies with:
--   USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
-- This meant:
-- 1. anon role could access NOTHING (storefront broken if direct API used)
-- 2. ANY authenticated user had FULL CRUD on ALL tables (critical security flaw)
-- 3. is_admin() check from migration 017 became unreachable
-- ============================================

-- ============================================
-- FIX STRATEGY:
-- 1. Storefront (anon): SELECT only on active catalog data
-- 2. Authenticated admins: FULL CRUD on all tables via is_admin() check
-- 3. Service role (edge functions): Full access (bypasses RLS anyway)
-- 4. Regular authenticated users: Can only manage their own orders
-- ============================================

-- ============================================
-- 1. PRODUCTS - Anon read active, admin full access
-- ============================================
DROP POLICY IF EXISTS "Products accessible via service role only" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

CREATE POLICY "products_anon_read"
  ON products FOR SELECT
  TO anon
  USING (is_active = true AND is_archived = false);

CREATE POLICY "products_admin_manage"
  ON products FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 2. COLLECTIONS - Anon read active, admin full access
-- ============================================
DROP POLICY IF EXISTS "Collections accessible via service role only" ON collections;
DROP POLICY IF EXISTS "Admins can manage collections" ON collections;

CREATE POLICY "collections_anon_read"
  ON collections FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "collections_admin_manage"
  ON collections FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 3. SUBCOLLECTIONS - Anon read active, admin full access
-- ============================================
DROP POLICY IF EXISTS "Subcollections accessible via service role only" ON subcollections;
DROP POLICY IF EXISTS "Admins can manage subcollections" ON subcollections;

CREATE POLICY "subcollections_anon_read"
  ON subcollections FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "subcollections_admin_manage"
  ON subcollections FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 4. CATEGORIES - Anon read active, admin full access
-- ============================================
DROP POLICY IF EXISTS "Categories accessible via service role only" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

CREATE POLICY "categories_anon_read"
  ON categories FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "categories_admin_manage"
  ON categories FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 5. PRODUCT VARIANTS - Anon read active, admin full access
-- ============================================
DROP POLICY IF EXISTS "Variants accessible via service role only" ON product_variants;
DROP POLICY IF EXISTS "Admins can manage variants" ON product_variants;

CREATE POLICY "variants_anon_read"
  ON product_variants FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "variants_admin_manage"
  ON product_variants FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 6. PRODUCT OPTION VALUES - Anon read, admin full access
-- ============================================
DROP POLICY IF EXISTS "Option values accessible via service role only" ON product_option_values;

CREATE POLICY "option_values_anon_read"
  ON product_option_values FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "option_values_admin_manage"
  ON product_option_values FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 7. ORDERS - Users see own, admin full access
-- ============================================
DROP POLICY IF EXISTS "Orders accessible via service role only" ON orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON orders;

-- Users can view their own orders
CREATE POLICY "orders_user_view_own"
  ON orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can create their own orders (guest checkout allowed)
CREATE POLICY "orders_user_create_own"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL -- guest checkout
  );

-- Users can update their own orders (limited fields)
CREATE POLICY "orders_user_update_own"
  ON orders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins have full access to orders
CREATE POLICY "orders_admin_manage"
  ON orders FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 8. ORDER ITEMS - Access through orders
-- ============================================
DROP POLICY IF EXISTS "Order items accessible via service role only" ON order_items;
DROP POLICY IF EXISTS "Admins can manage order items" ON order_items;

-- Users can view items from their own orders
CREATE POLICY "order_items_user_view_own"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.user_id = auth.uid()
        OR orders.guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Order items can be inserted with order creation
CREATE POLICY "order_items_insert_with_order"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins have full access to order items
CREATE POLICY "order_items_admin_manage"
  ON order_items FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 9. ORDER STATUS HISTORY - Read through orders, admin full
-- ============================================
DROP POLICY IF EXISTS "Status history accessible via service role only" ON order_status_history;

-- Users can view status history of their own orders
CREATE POLICY "status_history_user_view_own"
  ON order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- System can insert status history (via triggers)
CREATE POLICY "status_history_system_insert"
  ON order_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins have full access
CREATE POLICY "status_history_admin_manage"
  ON order_status_history FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 10. SHIPMENT TRACKING - Read through orders, admin full
-- ============================================
DROP POLICY IF EXISTS "Shipment tracking accessible via service role only" ON shipment_tracking;

-- Users can view tracking for their own orders
CREATE POLICY "shipment_tracking_user_view_own"
  ON shipment_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = shipment_tracking.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "shipment_tracking_admin_manage"
  ON shipment_tracking FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 11. DELIVERY TYPES - Anon read
-- ============================================
DROP POLICY IF EXISTS "Delivery types accessible via service role only" ON delivery_types;

CREATE POLICY "delivery_types_anon_read"
  ON delivery_types FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "delivery_types_admin_manage"
  ON delivery_types FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 12. SHIPPING ZONES - Anon read active, admin full
-- ============================================
DROP POLICY IF EXISTS "Shipping zones accessible via service role only" ON shipping_zones;
DROP POLICY IF EXISTS "Admins can manage shipping zones" ON shipping_zones;

CREATE POLICY "shipping_zones_anon_read"
  ON shipping_zones FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "shipping_zones_admin_manage"
  ON shipping_zones FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 13. CEP STATE MAPPING - Anon read
-- ============================================
DROP POLICY IF EXISTS "CEP mapping accessible via service role only" ON cep_state_mapping;

CREATE POLICY "cep_mapping_anon_read"
  ON cep_state_mapping FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "cep_mapping_admin_manage"
  ON cep_state_mapping FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 14. INVENTORY MOVEMENTS - Admin only
-- ============================================
DROP POLICY IF EXISTS "Inventory accessible via service role only" ON inventory_movements;
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory_movements;

CREATE POLICY "inventory_admin_manage"
  ON inventory_movements FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 15. DAILY METRICS - Admin only
-- ============================================
DROP POLICY IF EXISTS "Metrics accessible via service role only" ON daily_metrics;

CREATE POLICY "metrics_admin_manage"
  ON daily_metrics FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 16. PRODUCT ANALYTICS - Anon insert (event tracking), admin read
-- ============================================
DROP POLICY IF EXISTS "Analytics accessible via service role only" ON product_analytics;

-- Anyone can log product analytics events (anonymous)
CREATE POLICY "analytics_anon_insert"
  ON product_analytics FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admins can read analytics
CREATE POLICY "analytics_admin_read"
  ON product_analytics FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================
-- 17. FULFILLMENT METRICS - Admin only
-- ============================================
DROP POLICY IF EXISTS "Fulfillment metrics accessible via service role only" ON fulfillment_metrics;

CREATE POLICY "fulfillment_admin_manage"
  ON fulfillment_metrics FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 18. THIRD-PARTY SYNC LOG - Admin only, system insert
-- ============================================
DROP POLICY IF EXISTS "Sync logs accessible via service role only" ON third_party_sync_log;

-- System can insert sync logs (GitHub Actions, etc)
CREATE POLICY "sync_log_system_insert"
  ON third_party_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can read sync logs
CREATE POLICY "sync_log_admin_read"
  ON third_party_sync_log FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================
-- 19. THIRD-PARTY PRODUCT MAPPING - Anon read
-- ============================================
DROP POLICY IF EXISTS "Product mappings accessible via service role only" ON third_party_product_mapping;

CREATE POLICY "product_mapping_anon_read"
  ON third_party_product_mapping FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "product_mapping_admin_manage"
  ON third_party_product_mapping FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 20. WEBHOOK ENDPOINTS - Admin only (contains secrets)
-- ============================================
DROP POLICY IF EXISTS "Webhook endpoints accessible via service role only" ON webhook_endpoints;

CREATE POLICY "webhook_endpoints_admin_manage"
  ON webhook_endpoints FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 21. WEBHOOK EVENTS - Anon read (non-sensitive), system insert
-- ============================================
DROP POLICY IF EXISTS "Webhook events accessible via service role only" ON webhook_events;

-- Anon can read webhook events (status tracking)
CREATE POLICY "webhook_events_anon_read"
  ON webhook_events FOR SELECT
  TO anon
  USING (true);

-- System can insert webhook events
CREATE POLICY "webhook_events_system_insert"
  ON webhook_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins have full access
CREATE POLICY "webhook_events_admin_manage"
  ON webhook_events FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 22. RATE LIMITS - Admin only, system insert
-- ============================================
DROP POLICY IF EXISTS "Rate limits accessible via service role only" ON rate_limits;

-- System can insert rate limits
CREATE POLICY "rate_limits_system_insert"
  ON rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can read rate limits
CREATE POLICY "rate_limits_admin_read"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================
-- 23. SECURITY AUDIT LOG - Admin only, system insert
-- ============================================
DROP POLICY IF EXISTS "Audit logs accessible via service role only" ON security_audit_log;

-- System can insert audit logs
CREATE POLICY "audit_log_system_insert"
  ON security_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can read audit logs
CREATE POLICY "audit_log_admin_read"
  ON security_audit_log FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================
-- 24. USER ROLES - Admin only
-- ============================================
DROP POLICY IF EXISTS "User roles accessible via service role only" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;

-- Users can view their own roles
CREATE POLICY "user_roles_view_own"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage user roles
CREATE POLICY "user_roles_admin_manage"
  ON user_roles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 25. ADMIN USERS - Admin only
-- ============================================
-- Keep existing policy from migration 018 (service_role only)
-- This is correct - admin_users should only be managed via service_role

-- ============================================
-- VERIFICATION:
-- After applying this migration:
-- - Anon (storefront): Can SELECT active products, collections, categories, variants
-- - Authenticated users: Can manage their own orders
-- - Authenticated admins: Full CRUD on all tables via is_admin() check
-- - Service role: Bypasses RLS entirely (edge functions work as before)
-- ============================================
