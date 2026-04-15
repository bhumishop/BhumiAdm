-- Migration: 004_create_product_variants
-- Description: Creates product variants table for size, color, type combinations

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Variant attributes
  size TEXT, -- P, M, G, GG, XGG, Unique, etc.
  color TEXT,
  variant_type TEXT, -- material, style, or custom type
  -- Pricing overrides
  price_override NUMERIC(10, 2), -- if different from base product
  compare_at_price_override NUMERIC(10, 2),
  -- Stock
  sku TEXT, -- Stock Keeping Unit
  barcode TEXT,
  stock_quantity INTEGER DEFAULT 0,
  -- Media
  image_url TEXT, -- variant-specific image
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_size ON product_variants(size);
CREATE INDEX idx_variants_color ON product_variants(color);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_is_active ON product_variants(is_active);
CREATE UNIQUE INDEX idx_variants_unique_combo ON product_variants(
  product_id,
  COALESCE(size, ''),
  COALESCE(color, ''),
  COALESCE(variant_type, '')
);

-- Trigger for updated_at
CREATE TRIGGER update_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migration: Create predefined option values for common variants
CREATE TABLE IF NOT EXISTS product_option_values (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  option_type TEXT NOT NULL CHECK (option_type IN ('size', 'color', 'material', 'style')),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(option_type, value)
);

-- Seed common sizes
INSERT INTO product_option_values (option_type, value, label, sort_order) VALUES
  ('size', 'P', 'P (Pequeno)', 1),
  ('size', 'M', 'M (Médio)', 2),
  ('size', 'G', 'G (Grande)', 3),
  ('size', 'GG', 'GG (Extra Grande)', 4),
  ('size', 'XGG', 'XGG (Duplo Extra Grande)', 5),
  ('size', 'UN', 'Único', 6),
  ('size', 'A3', 'A3 (297x420mm)', 7),
  ('size', 'A4', 'A4 (210x297mm)', 8)
ON CONFLICT DO NOTHING;

-- Seed common colors
INSERT INTO product_option_values (option_type, value, label, sort_order) VALUES
  ('color', 'white', 'Branco', 1),
  ('color', 'black', 'Preto', 2),
  ('color', 'gray', 'Cinza', 3),
  ('color', 'navy', 'Azul Marinho', 4),
  ('color', 'beige', 'Bege', 5),
  ('color', 'natural', 'Natural', 6)
ON CONFLICT DO NOTHING;
