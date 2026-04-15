-- Migration: 022_update_fulfillment_types_to_uma_penca_uiclap_custom
-- Description: Updates fulfillment_type to only allow 'uma penca', 'uiclap', and 'custom'

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_fulfillment_type_check,
  ADD CONSTRAINT products_fulfillment_type_check CHECK (
    fulfillment_type IN ('uma penca', 'uiclap', 'custom')
  );

-- Also update order_items to allow these values (if constraint exists)
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_fulfillment_type_check,
  ADD CONSTRAINT order_items_fulfillment_type_check CHECK (
    fulfillment_type IN ('uma penca', 'uiclap', 'custom')
  );
