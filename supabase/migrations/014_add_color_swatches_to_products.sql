-- Migration: 014_add_color_swatches_to_products
-- Description: Adds a column to store color swatch image URLs separately from product images

-- Add color_swatches column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'color_swatches'
  ) THEN
    ALTER TABLE products ADD COLUMN color_swatches TEXT[] DEFAULT '{}';
  END IF;
END $$;
