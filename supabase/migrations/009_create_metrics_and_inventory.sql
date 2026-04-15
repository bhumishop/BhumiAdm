-- Migration: 009_create_metrics_and_inventory
-- Description: Creates metrics, inventory tracking, and analytics tables

-- Inventory movements (entrada/saída)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  -- Movement type
  movement_type TEXT NOT NULL CHECK (
    movement_type IN (
      'inbound_purchase',    -- stock received from supplier
      'inbound_return',      -- returned item back to stock
      'inbound_adjustment',  -- manual stock increase
      'outbound_sale',       -- sold item
      'outbound_damage',     -- damaged/lost item
      'outbound_adjustment', -- manual stock decrease
      'outbound_fulfillment' -- sent to third-party for fulfillment
    )
  ),
  -- Quantity
  quantity INTEGER NOT NULL,
  previous_stock INTEGER,
  new_stock INTEGER,
  -- Reference
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  reference_number TEXT, -- PO number, receipt number, etc.
  -- Location
  from_location TEXT,
  to_location TEXT,
  -- Notes
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_variant_id ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_movement_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_order_id ON inventory_movements(order_id);
CREATE INDEX idx_inventory_created_at ON inventory_movements(created_at DESC);

-- Daily sales metrics
CREATE TABLE IF NOT EXISTS daily_metrics (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date DATE NOT NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  subcollection_id UUID REFERENCES subcollections(id) ON DELETE SET NULL,
  -- Sales
  total_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  cancelled_orders INTEGER DEFAULT 0,
  -- Revenue
  gross_revenue NUMERIC(10, 2) DEFAULT 0,
  net_revenue NUMERIC(10, 2) DEFAULT 0,
  refunds_amount NUMERIC(10, 2) DEFAULT 0,
  -- Items
  total_items_sold INTEGER DEFAULT 0,
  -- By fulfillment type
  orders_by_fulfillment JSONB DEFAULT '{}'::jsonb,
  -- {own: {count: X, revenue: Y}, uma_penca: {...}, digital: {...}}
  -- Traffic
  product_views INTEGER DEFAULT 0,
  add_to_cart_count INTEGER DEFAULT 0,
  -- Conversion
  conversion_rate NUMERIC(5, 4), -- add_to_cart / views
  -- Shipping
  total_shipping_cost NUMERIC(10, 2) DEFAULT 0,
  average_order_value NUMERIC(10, 2),
  UNIQUE(date, collection_id, subcollection_id)
);

-- Indexes
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date DESC);
CREATE INDEX idx_daily_metrics_collection ON daily_metrics(collection_id);

-- Product views/analytics
CREATE TABLE IF NOT EXISTS product_analytics (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Event type
  event_type TEXT NOT NULL CHECK (
    event_type IN ('view', 'add_to_cart', 'remove_from_cart', 'purchase', 'wishlist', 'share')
  ),
  -- Session/user tracking (anonymous)
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Context
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  -- Device
  device_type TEXT, -- mobile, desktop, tablet
  country TEXT,
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analytics_product_id ON product_analytics(product_id);
CREATE INDEX idx_analytics_event_type ON product_analytics(event_type);
CREATE INDEX idx_analytics_created_at ON product_analytics(created_at DESC);
CREATE INDEX idx_analytics_session_id ON product_analytics(session_id);

-- Fulfillment metrics tracking
CREATE TABLE IF NOT EXISTS fulfillment_metrics (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  fulfillment_type TEXT NOT NULL,
  -- Timing
  order_placed_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ,
  preparation_started_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  -- Calculated metrics
  preparation_time_hours NUMERIC(10, 2), -- payment_confirmed -> shipped
  shipping_time_hours NUMERIC(10, 2), -- shipped -> delivered
  total_fulfillment_hours NUMERIC(10, 2), -- order_placed -> delivered
  -- Status
  is_on_time BOOLEAN,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  -- Issues
  has_issues BOOLEAN DEFAULT false,
  issue_details JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fulfillment_order_id ON fulfillment_metrics(order_id);
CREATE INDEX idx_fulfillment_type ON fulfillment_metrics(fulfillment_type);
CREATE INDEX idx_fulfillment_delivered ON fulfillment_metrics(delivered_at);

-- Trigger for updated_at
CREATE TRIGGER update_fulfillment_metrics_updated_at
  BEFORE UPDATE ON fulfillment_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-calculate fulfillment times
CREATE OR REPLACE FUNCTION calculate_fulfillment_times()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_confirmed_at IS NOT NULL AND NEW.shipped_at IS NOT NULL THEN
    NEW.preparation_time_hours := EXTRACT(EPOCH FROM (NEW.shipped_at - NEW.payment_confirmed_at)) / 3600;
  END IF;

  IF NEW.shipped_at IS NOT NULL AND NEW.delivered_at IS NOT NULL THEN
    NEW.shipping_time_hours := EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.shipped_at)) / 3600;
  END IF;

  IF NEW.order_placed_at IS NOT NULL AND NEW.delivered_at IS NOT NULL THEN
    NEW.total_fulfillment_hours := EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.order_placed_at)) / 3600;
  END IF;

  IF NEW.expected_delivery_date IS NOT NULL AND NEW.actual_delivery_date IS NOT NULL THEN
    NEW.is_on_time := NEW.actual_delivery_date <= NEW.expected_delivery_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_fulfillment_times_trigger
  BEFORE INSERT OR UPDATE ON fulfillment_metrics
  FOR EACH ROW
  EXECUTE FUNCTION calculate_fulfillment_times();
