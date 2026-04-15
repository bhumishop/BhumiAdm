-- Migration: 003_create_products
-- Description: Creates the comprehensive products table with all fields for dynamic/complex data

CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  -- Basic info
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  short_description TEXT,
  -- Category and collection relationships
  category TEXT, -- legacy category field (camisetas, livros, etc.)
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  subcollection_id UUID REFERENCES subcollections(id) ON DELETE SET NULL,
  -- Pricing
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  compare_at_price NUMERIC(10, 2), -- original price for discounts
  cost_price NUMERIC(10, 2), -- cost for margin calculation
  -- Stock and fulfillment
  stock_type TEXT NOT NULL DEFAULT 'print-on-demand' CHECK (
    stock_type IN ('print-on-demand', 'in-stock', 'digital', 'dropshipping')
  ),
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  fulfillment_type TEXT NOT NULL DEFAULT 'own' CHECK (
    fulfillment_type IN ('own', 'uma_penca', 'digital', 'third_party')
  ),
  -- Artist/Creator
  artist TEXT,
  brand TEXT,
  -- Product info
  info TEXT, -- additional information (newline separated)
  materials TEXT[], -- array of materials
  tags TEXT[] DEFAULT '{}',
  -- Physical properties
  weight NUMERIC(10, 3) DEFAULT 0.300, -- in kg
  dimensions JSONB, -- {width, height, depth} in cm
  -- Media
  image TEXT, -- primary image URL or base64
  images TEXT[] DEFAULT '{}', -- multiple images
  video_url TEXT,
  -- Shipping
  shipping_zones TEXT[], -- ['BR', 'US', etc.]
  shipping_class TEXT, -- standard, fragile, oversized
  is_free_shipping BOOLEAN DEFAULT false,
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  -- Third-party sync data (for UmaPenca injection)
  third_party_product_id TEXT, -- external product ID
  third_party_source TEXT, -- 'uma-penca', 'prata-print', etc.
  third_party_synced_at TIMESTAMPTZ,
  third_party_raw_data JSONB, -- raw data from third-party scrape
  -- Complex dynamic data
  metadata JSONB DEFAULT '{}'::jsonb, -- any additional dynamic fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_collection_id ON products(collection_id);
CREATE INDEX idx_products_subcollection_id ON products(subcollection_id);
CREATE INDEX idx_products_fulfillment_type ON products(fulfillment_type);
CREATE INDEX idx_products_stock_type ON products(stock_type);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_is_featured ON products(is_featured);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_third_party_source ON products(third_party_source);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_price ON products(price);

-- Full text search index - using trigger-based approach for compatibility
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.artist, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.brand, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_search_vector
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();

-- Initialize search vector for existing rows
UPDATE products SET search_vector =
  setweight(to_tsvector('portuguese', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(artist, '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(brand, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX idx_products_search_vector ON products USING GIN(search_vector);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_product_slug(product_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(product_name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM products WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
