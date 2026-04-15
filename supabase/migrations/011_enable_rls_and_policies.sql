-- Migration: 011_enable_rls_and_policies
-- Description: Enables Row Level Security on all tables and creates read-focused access policies
-- NOTE: This is the STOREFRONT version. Admin write policies are in BhumiAdm.

-- ============================================
-- Create rate_limits and security_audit_log tables first
-- (These are referenced later in this migration and created in 013)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  is_blocked BOOLEAN DEFAULT false,
  blocked_until TIMESTAMPTZ,
  block_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, action)
);

-- Enable RLS on rate_limits (admin only via service_role)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS security_audit_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'rate_limit_exceeded',
      'blocked_request',
      'suspicious_activity',
      'admin_action',
      'data_export',
      'auth_failure'
    )
  ),
  identifier TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on security_audit_log (admin only via service_role)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcollections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cep_state_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_party_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_party_product_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Collections: Public read active
-- ============================================
CREATE POLICY "Collections are viewable by everyone"
  ON collections FOR SELECT
  USING (is_active = true);

-- ============================================
-- Subcollections: Public read active
-- ============================================
CREATE POLICY "Subcollections are viewable by everyone"
  ON subcollections FOR SELECT
  USING (is_active = true);

-- ============================================
-- Products: Public read active
-- ============================================
CREATE POLICY "Active products are viewable by everyone"
  ON products FOR SELECT
  USING (is_active = true AND is_archived = false);

-- ============================================
-- Product variants: Public read active
-- ============================================
CREATE POLICY "Active variants are viewable by everyone"
  ON product_variants FOR SELECT
  USING (is_active = true);

-- ============================================
-- Product option values: Public read
-- ============================================
CREATE POLICY "Option values are viewable by everyone"
  ON product_option_values FOR SELECT
  USING (true);

-- ============================================
-- Categories: Public read active
-- ============================================
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  USING (is_active = true);

-- ============================================
-- Orders: Users see own orders
-- ============================================
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (
    user_id = auth.uid()
    OR guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL -- guest checkout
  );

CREATE POLICY "Users can update their own orders"
  ON orders FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- Order items: Access through orders
-- ============================================
CREATE POLICY "Users can view order items from their orders"
  ON order_items FOR SELECT
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

CREATE POLICY "Order items can be inserted with order creation"
  ON order_items FOR INSERT
  WITH CHECK (true); -- Inserted via order creation flow

-- ============================================
-- Order status history: Read through orders
-- ============================================
CREATE POLICY "Users can view status history of their orders"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert status history"
  ON order_status_history FOR INSERT
  WITH CHECK (true); -- Inserted via triggers

-- ============================================
-- Shipment tracking: Read through orders
-- ============================================
CREATE POLICY "Users can view tracking for their orders"
  ON shipment_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = shipment_tracking.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- ============================================
-- Delivery types: Public read active
-- ============================================
CREATE POLICY "Delivery types are viewable by everyone"
  ON delivery_types FOR SELECT
  USING (is_active = true);

-- ============================================
-- Shipping zones: Public read active
-- ============================================
CREATE POLICY "Shipping zones are viewable by everyone"
  ON shipping_zones FOR SELECT
  USING (is_active = true);

-- ============================================
-- CEP state mapping: Public read
-- ============================================
CREATE POLICY "CEP mapping is viewable by everyone"
  ON cep_state_mapping FOR SELECT
  USING (true);

-- ============================================
-- Inventory movements: Read-only via service role
-- ============================================
-- No anon access - admin only via service_role

-- ============================================
-- Daily metrics: Read-only via service role
-- ============================================
-- No anon access - admin only via service_role

-- ============================================
-- Product analytics: Public insert (anonymous)
-- ============================================
CREATE POLICY "Anyone can log product analytics"
  ON product_analytics FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Fulfillment metrics: Read-only via service role
-- ============================================
-- No anon access - admin only via service_role

-- ============================================
-- Third-party sync log: Read-only via service role
-- ============================================
-- No anon access - admin/system only via service_role

CREATE POLICY "System can insert sync logs"
  ON third_party_sync_log FOR INSERT
  WITH CHECK (true); -- Inserted by GitHub Actions

-- ============================================
-- Third-party product mapping: Public read
-- ============================================
CREATE POLICY "Product mappings are viewable by everyone"
  ON third_party_product_mapping FOR SELECT
  USING (true);

-- ============================================
-- Webhook endpoints: Read-only via service role
-- ============================================
-- No anon access - admin only via service_role

-- ============================================
-- Webhook events: System insert
-- ============================================
CREATE POLICY "System can insert webhook events"
  ON webhook_events FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Rate limits: Read-only via service role
-- ============================================
-- No anon access - admin only via service_role
CREATE POLICY "System can insert rate limits"
  ON rate_limits FOR INSERT
  WITH CHECK (true); -- Inserted by rate limiting functions

-- ============================================
-- Security audit log: Read-only via service role
-- ============================================
-- No anon access - admin only via service_role
CREATE POLICY "System can insert audit logs"
  ON security_audit_log FOR INSERT
  WITH CHECK (true); -- Inserted by security functions
