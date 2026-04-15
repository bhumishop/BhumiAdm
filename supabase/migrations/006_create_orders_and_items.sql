-- Migration: 006_create_orders_and_items
-- Description: Creates orders and order_items tables with comprehensive order management

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Order identification
  order_number VARCHAR(20) UNIQUE NOT NULL, -- BH2026000001 format
  -- User relationship
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email TEXT, -- for guest checkout
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded')
  ),
  -- Payment info
  payment_method VARCHAR(50) NOT NULL, -- pix, billing, pix_bricks, uma_penca, paypal, mercadopago
  payment_provider VARCHAR(50), -- abacatepay, pix_bricks, uma_penca, etc.
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded')
  ),
  payment_reference TEXT, -- external payment ID (pix transaction ID, etc.)
  payment_paid_at TIMESTAMPTZ,
  -- Pricing
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(10, 2) DEFAULT 0,
  discount_amount NUMERIC(10, 2) DEFAULT 0,
  tax_amount NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_tax_id TEXT, -- CPF/CNPJ
  -- Shipping address (full structured address)
  shipping_address TEXT, -- formatted address string
  shipping_address_structured JSONB, -- {street, number, complement, neighborhood, city, state, cep, country}
  -- Fulfillment grouping
  fulfillment_groups JSONB DEFAULT '[]'::jsonb, -- [{type: 'own'|'uma_penca'|'digital', items: [...], status: '...'}]
  -- Notes
  notes TEXT,
  admin_notes TEXT, -- internal notes
  -- Cancellation/Refund
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  refunded_at TIMESTAMPTZ,
  refund_amount NUMERIC(10, 2),
  refund_reason TEXT,
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_guest_email ON orders(guest_email);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Product reference
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  -- Snapshot of product at time of order
  product_name TEXT NOT NULL,
  product_sku TEXT,
  -- Variant info
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  variant_details JSONB, -- {size: 'M', color: 'black', ...}
  -- Pricing
  product_price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC(10, 2) NOT NULL, -- price * quantity
  -- Fulfillment
  fulfillment_type TEXT NOT NULL DEFAULT 'own' CHECK (
    fulfillment_type IN ('own', 'uma_penca', 'digital', 'third_party')
  ),
  -- Shipping for this item
  shipping_cost NUMERIC(10, 2) DEFAULT 0,
  weight NUMERIC(10, 3), -- in kg
  -- Status per item
  status VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN ('pending', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded')
  ),
  -- Tracking
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  -- Third-party info
  third_party_order_id TEXT,
  third_party_source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_fulfillment_type ON order_items(fulfillment_type);
CREATE INDEX idx_order_items_status ON order_items(status);

-- Trigger for orders updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  sequence INTEGER;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 9) AS INTEGER)
  ), 0) + 1 INTO sequence
  FROM orders
  WHERE order_number LIKE 'BH' || year_part || '%';

  new_number := 'BH' || year_part || LPAD(sequence::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
