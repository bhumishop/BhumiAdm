-- =============================================================================
-- MIGRATION 016: STOREFRONT READ-ONLY ACCESS - BHUMI SHOP
-- =============================================================================
-- Ensures the storefront (anon role) can only READ active products, categories,
-- collections, and variants. No write access to product data from the storefront.
-- REMOVED: Sensitive table access (webhook_endpoints, audit_log, rate_limits)
-- =============================================================================

-- Products: storefront can only READ active products
DROP POLICY IF EXISTS "Allow product reads" ON products;
CREATE POLICY "Allow product reads" ON products
  FOR SELECT TO anon USING (is_active = true);

-- Categories: read-only for storefront
DROP POLICY IF EXISTS "Allow category reads" ON categories;
CREATE POLICY "Allow category reads" ON categories
  FOR SELECT TO anon USING (true);

-- Collections: read-only for storefront
DROP POLICY IF EXISTS "Allow collection reads" ON collections;
CREATE POLICY "Allow collection reads" ON collections
  FOR SELECT TO anon USING (is_active = true);

-- Subcollections: read-only for storefront
DROP POLICY IF EXISTS "Allow subcollection reads" ON subcollections;
CREATE POLICY "Allow subcollection reads" ON subcollections
  FOR SELECT TO anon USING (is_active = true);

-- Product variants: read-only for storefront
DROP POLICY IF EXISTS "Allow variant reads" ON product_variants;
CREATE POLICY "Allow variant reads" ON product_variants
  FOR SELECT TO anon USING (is_active = true);

-- Product option values: read-only for storefront
DROP POLICY IF EXISTS "Allow option value reads" ON product_option_values;
CREATE POLICY "Allow option value reads" ON product_option_values
  FOR SELECT TO anon USING (true);

-- Order tracking: read-only for storefront (limited to own orders via 011)
-- No additional policy needed - 011 already restricts to order owners

-- Shipment tracking: read-only for storefront (limited to own orders via 011)
-- No additional policy needed - 011 already restricts to order owners

-- Delivery types: read-only for storefront
DROP POLICY IF EXISTS "Allow delivery type reads" ON delivery_types;
CREATE POLICY "Allow delivery type reads" ON delivery_types
  FOR SELECT TO anon USING (true);

-- Shipping zones: read-only for storefront
DROP POLICY IF EXISTS "Allow shipping zone reads" ON shipping_zones;
CREATE POLICY "Allow shipping zone reads" ON shipping_zones
  FOR SELECT TO anon USING (true);

-- CEP state mapping: read-only for storefront
DROP POLICY IF EXISTS "Allow cep mapping reads" ON cep_state_mapping;
CREATE POLICY "Allow cep mapping reads" ON cep_state_mapping
  FOR SELECT TO anon USING (true);

-- Third party product mapping: read-only for storefront
DROP POLICY IF EXISTS "Allow product mapping reads" ON third_party_product_mapping;
CREATE POLICY "Allow product mapping reads" ON third_party_product_mapping
  FOR SELECT TO anon USING (true);

-- Webhook events: read-only for storefront (non-sensitive)
DROP POLICY IF EXISTS "Allow webhook event reads" ON webhook_events;
CREATE POLICY "Allow webhook event reads" ON webhook_events
  FOR SELECT TO anon USING (true);

-- REMOVED SENSITIVE TABLE ACCESS - Admin only via service_role:
-- - webhook_endpoints (contains API secrets)
-- - inventory_movements (internal business data)
-- - daily_metrics (internal business data)
-- - product_analytics (internal business data)
-- - fulfillment_metrics (internal business data)
-- - third_party_sync_log (internal system data)
-- - rate_limits (security infrastructure)
-- - security_audit_log (security infrastructure)

-- Color swatches: read-only for storefront (column on products, no separate policy needed)
