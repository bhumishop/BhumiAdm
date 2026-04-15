-- Migration: 002_create_subcollections
-- Description: Creates subcollections table (UmaPenca/dropshipping, HandCrafted, Revenda, etc.)
-- Subcollections belong to collections and define the type of product fulfillment

CREATE TABLE IF NOT EXISTS subcollections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  -- Fulfillment type: dropshipping, handcrafted, revenda, print-on-demand, digital, own-stock
  fulfillment_type TEXT NOT NULL DEFAULT 'own-stock' CHECK (
    fulfillment_type IN ('dropshipping', 'handcrafted', 'revenda', 'print-on-demand', 'digital', 'own-stock')
  ),
  -- Third-party store info (for dropshipping like UmaPenca)
  third_party_store_url TEXT,
  third_party_api_endpoint TEXT,
  third_party_sync_enabled BOOLEAN DEFAULT false,
  third_party_sync_schedule TEXT, -- cron-like schedule
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subcollections_collection_id ON subcollections(collection_id);
CREATE INDEX idx_subcollections_slug ON subcollections(slug);
CREATE INDEX idx_subcollections_fulfillment_type ON subcollections(fulfillment_type);
CREATE INDEX idx_subcollections_active ON subcollections(is_active);

-- Seed initial subcollections
INSERT INTO subcollections (collection_id, slug, name, description, icon, fulfillment_type, sort_order)
SELECT
  c.id,
  'uma-penca',
  'UmaPenca',
  'Dropshipping products from UmaPenca store',
  '🛍️',
  'dropshipping',
  1
FROM collections c WHERE c.slug = 'bhumi-print'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subcollections (collection_id, slug, name, description, icon, fulfillment_type, sort_order)
SELECT
  c.id,
  'handcrafted',
  'HandCrafted/Artesanato',
  'Handmade artisanal products',
  '🧶',
  'handcrafted',
  2
FROM collections c WHERE c.slug = 'bhumi-print'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subcollections (collection_id, slug, name, description, icon, fulfillment_type, sort_order)
SELECT
  c.id,
  'revenda',
  'Revenda',
  'Resale products',
  '🔄',
  'revenda',
  3
FROM collections c WHERE c.slug = 'bhumi-print'
ON CONFLICT (slug) DO NOTHING;
