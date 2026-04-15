-- Migration: 017_fix_production_issues
-- Description: Fixes critical schema mismatches between migrations and edge functions
-- Adds missing columns, fixes trigger, and adds admin write policies

-- ============================================
-- 1. Add missing pix_key column to orders table
-- (Referenced by abacatepay-webhook edge function)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pix_key'
  ) THEN
    ALTER TABLE orders ADD COLUMN pix_key TEXT;
    CREATE INDEX idx_orders_pix_key ON orders(pix_key);
  END IF;
END $$;

-- ============================================
-- 2. Add missing expired payment status check
-- ============================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'expired')
);

-- ============================================
-- 3. Add auto-slug generation trigger to products
-- ============================================
CREATE OR REPLACE FUNCTION generate_product_slug_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_product_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_product_slug_trigger ON products;
CREATE TRIGGER generate_product_slug_trigger
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_slug_on_insert();

-- ============================================
-- 4. Add updated_at trigger to order_items
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_order_items_updated_at'
  ) THEN
    ALTER TABLE order_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE TRIGGER update_order_items_updated_at
      BEFORE UPDATE ON order_items
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 5. Add missing indexes for production performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_products_created_at_asc ON products(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_order_items_status_tracking ON order_items(status, fulfillment_type);

-- ============================================
-- 6. Add database functions for common operations
-- ============================================

-- Function to safely create order with order number
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_payment_method TEXT,
  p_items JSONB, -- [{product_id, variant_id, quantity, product_price, fulfillment_type}]
  p_user_id UUID DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_tax_id TEXT DEFAULT NULL,
  p_shipping_address TEXT DEFAULT NULL,
  p_shipping_address_structured JSONB DEFAULT NULL,
  p_payment_provider TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal NUMERIC(10, 2) := 0;
  v_total NUMERIC(10, 2);
  v_item JSONB;
  v_product_record RECORD;
BEGIN
  -- Generate order number
  v_order_number := generate_order_number();

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + (v_item->>'product_price')::NUMERIC * (v_item->>'quantity')::INTEGER;
  END LOOP;

  -- Create order
  INSERT INTO orders (
    order_number,
    user_id,
    guest_email,
    customer_name,
    customer_email,
    customer_phone,
    customer_tax_id,
    shipping_address,
    shipping_address_structured,
    payment_method,
    payment_provider,
    subtotal,
    total,
    notes,
    status,
    payment_status
  ) VALUES (
    v_order_number,
    p_user_id,
    p_guest_email,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_customer_tax_id,
    p_shipping_address,
    p_shipping_address_structured,
    p_payment_method,
    p_payment_provider,
    v_subtotal,
    v_subtotal, -- Will be updated with shipping cost later
    p_notes,
    'pending',
    'pending'
  ) RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get product name for snapshot
    SELECT name INTO v_product_record FROM products WHERE id = (v_item->>'product_id')::BIGINT;

    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      variant_id,
      variant_details,
      product_price,
      quantity,
      subtotal,
      fulfillment_type
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::BIGINT,
      v_product_record.name,
      (v_item->>'variant_id')::BIGINT,
      v_item->'variant_details',
      (v_item->>'product_price')::NUMERIC,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'product_price')::NUMERIC * (v_item->>'quantity')::INTEGER,
      v_item->>'fulfillment_type'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_subtotal
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Add admin write policies for authenticated admins
-- ============================================

-- Create admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for products
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for collections
DROP POLICY IF EXISTS "Admins can manage collections" ON collections;
CREATE POLICY "Admins can manage collections"
  ON collections FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for subcollections
DROP POLICY IF EXISTS "Admins can manage subcollections" ON subcollections;
CREATE POLICY "Admins can manage subcollections"
  ON subcollections FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for categories
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for product_variants
DROP POLICY IF EXISTS "Admins can manage variants" ON product_variants;
CREATE POLICY "Admins can manage variants"
  ON product_variants FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for orders
DROP POLICY IF EXISTS "Admins can manage orders" ON orders;
CREATE POLICY "Admins can manage orders"
  ON orders FOR ALL
  USING (is_admin() OR auth.role() = 'service_role' OR user_id = auth.uid())
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for order_items
DROP POLICY IF EXISTS "Admins can manage order items" ON order_items;
CREATE POLICY "Admins can manage order items"
  ON order_items FOR ALL
  USING (
    is_admin() OR
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  )
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for inventory
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory_movements;
CREATE POLICY "Admins can manage inventory"
  ON inventory_movements FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for shipping zones
DROP POLICY IF EXISTS "Admins can manage shipping zones" ON shipping_zones;
CREATE POLICY "Admins can manage shipping zones"
  ON shipping_zones FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Admin policies for user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');
