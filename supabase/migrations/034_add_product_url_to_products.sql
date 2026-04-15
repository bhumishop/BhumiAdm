-- Migration: 034_add_product_url_to_products
-- Description: Adds product_url column to store the canonical URL for each product
-- (used for embedded umapenca/uiclap product pages and external links)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_product_url ON products(product_url);

-- Add comment for documentation
COMMENT ON COLUMN products.product_url IS 'Canonical product URL (from scraper or manually set). Used for embedded product pages and external links.';
