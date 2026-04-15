-- Migration: 001_create_collections
-- Description: Creates the collections table (BhumiPrint, PrataPrint, KintalDaDita, MariArts, SOS, etc.)
-- Collections are the top-level organizational unit for products

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  logo_url TEXT,
  banner_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_collections_slug ON collections(slug);
CREATE INDEX idx_collections_active ON collections(is_active);
CREATE INDEX idx_collections_sort_order ON collections(sort_order);

-- Seed initial collections
INSERT INTO collections (slug, name, description, icon, sort_order) VALUES
  ('bhumi-print', 'BhumiPrint', 'Print on demand products by Bhumi', '🖨️', 1),
  ('prata-print', 'PrataPrint', 'Silver print collection', '🥈', 2),
  ('kintal-da-dita', 'KintalDaDita', 'Curated artisan collection', '🎨', 3),
  ('mari-arts', 'MariArts', 'Art and crafts by Mari', '🖌️', 4),
  ('sos', 'SOS', 'Special offer selections', '🆘', 5)
ON CONFLICT (slug) DO NOTHING;
