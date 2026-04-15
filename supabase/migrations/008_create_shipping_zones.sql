-- Migration: 008_create_shipping_zones
-- Description: Creates shipping zones and rates configuration

CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- Zone definition
  states TEXT[] DEFAULT '{}', -- Brazilian states in this zone
  countries TEXT[] DEFAULT '{}', -- country codes
  cep_ranges JSONB DEFAULT '[]'::jsonb, -- [[start, end], ...]
  -- Base rates
  base_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  per_kg_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Delivery estimates
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  -- Free shipping threshold
  free_shipping_above NUMERIC(10, 2),
  -- Status
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shipping_zones_is_active ON shipping_zones(is_active);

-- Seed Brazilian shipping zones (matching the shipping.js logic)
INSERT INTO shipping_zones (name, states, base_cost, per_kg_cost, estimated_days_min, estimated_days_max, free_shipping_above) VALUES
  ('Sudeste', ARRAY['SP', 'RJ', 'MG', 'ES'], 12.90, 3.50, 3, 5, 200),
  ('Sul', ARRAY['PR', 'SC', 'RS'], 15.90, 4.50, 4, 6, 200),
  ('Nordeste', ARRAY['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'], 22.90, 6.90, 6, 10, 200),
  ('Norte', ARRAY['PA', 'AM', 'RR', 'AP', 'TO', 'RO', 'AC'], 28.90, 8.90, 8, 14, 200),
  ('Centro-Oeste', ARRAY['GO', 'MT', 'MS', 'DF'], 18.90, 5.50, 5, 8, 200)
ON CONFLICT DO NOTHING;

-- CEP to state mapping table for lookup
CREATE TABLE IF NOT EXISTS cep_state_mapping (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  cep_start INTEGER NOT NULL,
  cep_end INTEGER NOT NULL,
  state TEXT NOT NULL,
  UNIQUE(cep_start, cep_end)
);

-- Index for CEP range queries
CREATE INDEX idx_cep_state_range ON cep_state_mapping(cep_start, cep_end);

-- Seed CEP ranges (matching shipping.js CEP_RANGES)
INSERT INTO cep_state_mapping (cep_start, cep_end, state) VALUES
  (1000000, 1999999, 'SP'),
  (2000000, 2899999, 'RJ'),
  (2900000, 3999999, 'MG'),
  (4000000, 4999999, 'BA'),
  (5000000, 5699999, 'PE'),
  (5700000, 5799999, 'SE'),
  (5800000, 5999999, 'PB'),
  (6000000, 6399999, 'CE'),
  (6400000, 6499999, 'PI'),
  (6500000, 6599999, 'MA'),
  (6600000, 6999999, 'PA'),
  (6900000, 6929999, 'AM'),
  (6930000, 6949999, 'RR'),
  (6940000, 6959999, 'AP'),
  (6960000, 6989999, 'AM'),
  (7680000, 7699999, 'RO'),
  (7700000, 7799999, 'TO'),
  (7800000, 7889999, 'MT'),
  (7890000, 7899999, 'MS'),
  (7900000, 7999999, 'MS'),
  (8000000, 8799999, 'PR'),
  (8800000, 8999999, 'SC'),
  (9000000, 9999999, 'RS'),
  (7000000, 7099999, 'DF'),
  (7100000, 7279999, 'DF'),
  (7280000, 7679999, 'GO')
ON CONFLICT DO NOTHING;

-- Function to get state from CEP
CREATE OR REPLACE FUNCTION get_state_from_cep(cep TEXT)
RETURNS TEXT AS $$
DECLARE
  cep_num INTEGER;
  result_state TEXT;
BEGIN
  cep_num := CAST(regexp_replace(cep, '\D', '', 'g') AS INTEGER);

  SELECT state INTO result_state
  FROM cep_state_mapping
  WHERE cep_num BETWEEN cep_start AND cep_end
  LIMIT 1;

  RETURN result_state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get shipping zone from state
CREATE OR REPLACE FUNCTION get_zone_from_state(state TEXT)
RETURNS TABLE(zone_id UUID, zone_name TEXT, base_cost NUMERIC, per_kg_cost NUMERIC, days_min INTEGER, days_max INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT sz.id, sz.name, sz.base_cost, sz.per_kg_cost, sz.estimated_days_min, sz.estimated_days_max
  FROM shipping_zones sz
  WHERE sz.states @> ARRAY[state]
    AND sz.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updated_at
CREATE TRIGGER update_shipping_zones_updated_at
  BEFORE UPDATE ON shipping_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
