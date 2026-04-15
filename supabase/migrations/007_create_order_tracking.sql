-- Migration: 007_create_order_tracking
-- Description: Creates order status history and shipment tracking tables

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Status change
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  -- Who changed it
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role TEXT DEFAULT 'system', -- 'admin', 'system', 'customer', 'webhook'
  -- Reason
  reason TEXT,
  notes TEXT,
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_status_history_created_at ON order_status_history(created_at DESC);

-- Trigger to auto-insert status history when order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_by_role)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), COALESCE(current_setting('app.current_role', true), 'system'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_order_status_change_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- Also log on insert (initial status)
CREATE OR REPLACE FUNCTION log_order_initial_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_by_role)
  VALUES (NEW.id, NULL, NEW.status, auth.uid(), COALESCE(current_setting('app.current_role', true), 'system'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_order_initial_status_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_initial_status();

-- Shipment tracking table for detailed logistics
CREATE TABLE IF NOT EXISTS shipment_tracking (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
  -- Carrier info
  carrier TEXT NOT NULL, -- Correios, Jadlog, third-party, etc.
  tracking_number TEXT NOT NULL,
  tracking_url TEXT,
  -- Delivery type
  delivery_type TEXT CHECK (
    delivery_type IN ('standard', 'express', 'same-day', 'pickup', 'international', 'digital')
  ),
  -- Status
  status TEXT NOT NULL DEFAULT 'info_received' CHECK (
    status IN (
      'info_received',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'failed_attempt',
      'returned',
      'lost'
    )
  ),
  -- Location history (array of tracking events)
  tracking_events JSONB DEFAULT '[]'::jsonb,
  -- [{timestamp: '...', location: '...', status: '...', description: '...'}]
  -- Estimated and actual delivery
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  -- Known shipping locations/history
  origin_location JSONB, -- {city, state, country, facility}
  current_location JSONB,
  destination_location JSONB,
  -- Delivery attempts
  delivery_attempts JSONB DEFAULT '[]'::jsonb,
  -- [{date: '...', status: 'success'|'failed', reason: '...', signed_by: '...'}]
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shipment_tracking_order_id ON shipment_tracking(order_id);
CREATE INDEX idx_shipment_tracking_order_item_id ON shipment_tracking(order_item_id);
CREATE INDEX idx_shipment_tracking_tracking_number ON shipment_tracking(tracking_number);
CREATE INDEX idx_shipment_tracking_status ON shipment_tracking(status);
CREATE INDEX idx_shipment_tracking_carrier ON shipment_tracking(carrier);

-- Trigger for updated_at
CREATE TRIGGER update_shipment_tracking_updated_at
  BEFORE UPDATE ON shipment_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Delivery types reference table
CREATE TABLE IF NOT EXISTS delivery_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  carrier TEXT, -- default carrier for this type
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Seed delivery types
INSERT INTO delivery_types (id, name, description, estimated_days_min, estimated_days_max) VALUES
  ('standard', 'Padrão', 'Entrega padrão via Correios', 3, 10),
  ('express', 'Expressa', 'Entrega expressa via Jadlog', 1, 3),
  ('same-day', 'Mesmo Dia', 'Entrega no mesmo dia (regiões selecionadas)', 0, 0),
  ('pickup', 'Retirada', 'Retirada no local', 0, 0),
  ('international', 'Internacional', 'Entrega internacional', 10, 30),
  ('digital', 'Digital', 'Entrega digital (download imediato)', 0, 0)
ON CONFLICT DO NOTHING;
