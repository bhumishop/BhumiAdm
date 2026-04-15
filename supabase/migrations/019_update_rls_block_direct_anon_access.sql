-- Migration: 019_update_rls_block_direct_anon_access
-- Description: Updates all RLS policies to block direct anon API calls
-- All data access must go through edge functions with JWT validation
-- Edge functions use service_role key which bypasses RLS

-- ============================================
-- Remove all existing anon policies
-- ============================================

-- Products - Remove anon read, only service_role can access
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Allow product reads" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- Only service_role (edge functions) can access products
CREATE POLICY "Products accessible via service role only"
  ON products FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Collections
DROP POLICY IF EXISTS "Collections are viewable by everyone" ON collections;
DROP POLICY IF EXISTS "Allow collection reads" ON collections;
DROP POLICY IF EXISTS "Admins can manage collections" ON collections;

CREATE POLICY "Collections accessible via service role only"
  ON collections FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Subcollections
DROP POLICY IF EXISTS "Subcollections are viewable by everyone" ON subcollections;
DROP POLICY IF EXISTS "Allow subcollection reads" ON subcollections;
DROP POLICY IF EXISTS "Admins can manage subcollections" ON subcollections;

CREATE POLICY "Subcollections accessible via service role only"
  ON subcollections FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Categories
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Allow category reads" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

CREATE POLICY "Categories accessible via service role only"
  ON categories FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Product variants
DROP POLICY IF EXISTS "Active variants are viewable by everyone" ON product_variants;
DROP POLICY IF EXISTS "Allow variant reads" ON product_variants;
DROP POLICY IF EXISTS "Admins can manage variants" ON product_variants;

CREATE POLICY "Variants accessible via service role only"
  ON product_variants FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Product option values
DROP POLICY IF EXISTS "Option values are viewable by everyone" ON product_option_values;
DROP POLICY IF EXISTS "Allow option value reads" ON product_option_values;

CREATE POLICY "Option values accessible via service role only"
  ON product_option_values FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON orders;

CREATE POLICY "Orders accessible via service role only"
  ON orders FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Order items
DROP POLICY IF EXISTS "Users can view order items from their orders" ON order_items;
DROP POLICY IF EXISTS "Order items can be inserted with order creation" ON order_items;
DROP POLICY IF EXISTS "Admins can manage order items" ON order_items;

CREATE POLICY "Order items accessible via service role only"
  ON order_items FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Order status history
DROP POLICY IF EXISTS "Users can view status history of their orders" ON order_status_history;
DROP POLICY IF EXISTS "System can insert status history" ON order_status_history;

CREATE POLICY "Status history accessible via service role only"
  ON order_status_history FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Shipment tracking
DROP POLICY IF EXISTS "Users can view tracking for their orders" ON shipment_tracking;

CREATE POLICY "Shipment tracking accessible via service role only"
  ON shipment_tracking FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Delivery types
DROP POLICY IF EXISTS "Delivery types are viewable by everyone" ON delivery_types;
DROP POLICY IF EXISTS "Allow delivery type reads" ON delivery_types;

CREATE POLICY "Delivery types accessible via service role only"
  ON delivery_types FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Shipping zones
DROP POLICY IF EXISTS "Shipping zones are viewable by everyone" ON shipping_zones;
DROP POLICY IF EXISTS "Allow shipping zone reads" ON shipping_zones;
DROP POLICY IF EXISTS "Admins can manage shipping zones" ON shipping_zones;

CREATE POLICY "Shipping zones accessible via service role only"
  ON shipping_zones FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- CEP state mapping
DROP POLICY IF EXISTS "CEP mapping is viewable by everyone" ON cep_state_mapping;
DROP POLICY IF EXISTS "Allow cep mapping reads" ON cep_state_mapping;

CREATE POLICY "CEP mapping accessible via service role only"
  ON cep_state_mapping FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Inventory movements
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory_movements;

CREATE POLICY "Inventory accessible via service role only"
  ON inventory_movements FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Daily metrics
CREATE POLICY "Metrics accessible via service role only"
  ON daily_metrics FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Product analytics
DROP POLICY IF EXISTS "Anyone can log product analytics" ON product_analytics;

CREATE POLICY "Analytics accessible via service role only"
  ON product_analytics FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Fulfillment metrics
CREATE POLICY "Fulfillment metrics accessible via service role only"
  ON fulfillment_metrics FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Third-party sync log
DROP POLICY IF EXISTS "System can insert sync logs" ON third_party_sync_log;

CREATE POLICY "Sync logs accessible via service role only"
  ON third_party_sync_log FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Third-party product mapping
DROP POLICY IF EXISTS "Product mappings are viewable by everyone" ON third_party_product_mapping;
DROP POLICY IF EXISTS "Allow product mapping reads" ON third_party_product_mapping;

CREATE POLICY "Product mappings accessible via service role only"
  ON third_party_product_mapping FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Webhook endpoints
CREATE POLICY "Webhook endpoints accessible via service role only"
  ON webhook_endpoints FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Webhook events
DROP POLICY IF EXISTS "System can insert webhook events" ON webhook_events;
DROP POLICY IF EXISTS "Allow webhook event reads" ON webhook_events;

CREATE POLICY "Webhook events accessible via service role only"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Rate limits
DROP POLICY IF EXISTS "System can insert rate limits" ON rate_limits;

CREATE POLICY "Rate limits accessible via service role only"
  ON rate_limits FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Security audit log
DROP POLICY IF EXISTS "System can insert audit logs" ON security_audit_log;

CREATE POLICY "Audit logs accessible via service role only"
  ON security_audit_log FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- User roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;

CREATE POLICY "User roles accessible via service role only"
  ON user_roles FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
