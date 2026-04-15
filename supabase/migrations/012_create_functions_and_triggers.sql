-- Migration: 012_create_functions_and_triggers
-- Description: Creates additional helper functions, triggers, and views

-- ============================================
-- Views for common queries
-- ============================================

-- Product details view (joins with collection, subcollection, category)
CREATE OR REPLACE VIEW product_details AS
SELECT
  p.*,
  c.slug AS collection_slug,
  c.name AS collection_name,
  sc.slug AS subcollection_slug,
  sc.name AS subcollection_name,
  sc.fulfillment_type AS subcollection_fulfillment_type,
  cat.name AS category_name,
  cat.icon AS category_icon,
  (
    SELECT json_agg(pv.* ORDER BY pv.sort_order)
    FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.is_active = true
  ) AS variants
FROM products p
LEFT JOIN collections c ON p.collection_id = c.id
LEFT JOIN subcollections sc ON p.subcollection_id = sc.id
LEFT JOIN categories cat ON p.category = cat.id
WHERE p.is_archived = false;

-- Order details view
CREATE OR REPLACE VIEW order_details AS
SELECT
  o.*,
  (
    SELECT json_agg(json_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'variant_details', oi.variant_details,
      'product_price', oi.product_price,
      'quantity', oi.quantity,
      'subtotal', oi.subtotal,
      'fulfillment_type', oi.fulfillment_type,
      'status', oi.status,
      'tracking_number', oi.tracking_number
    ))
    FROM order_items oi
    WHERE oi.order_id = o.id
  ) AS items,
  (
    SELECT json_agg(osh.* ORDER BY osh.created_at ASC)
    FROM order_status_history osh
    WHERE osh.order_id = o.id
  ) AS status_history
FROM orders o;

-- Collection summary view
CREATE OR REPLACE VIEW collection_summary AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.icon,
  c.is_active,
  (
    SELECT COUNT(*) FROM subcollections sc WHERE sc.collection_id = c.id AND sc.is_active = true
  ) AS active_subcollections_count,
  (
    SELECT COUNT(*) FROM products p
    WHERE p.collection_id = c.id AND p.is_active = true AND p.is_archived = false
  ) AS active_products_count,
  (
    SELECT COUNT(*) FROM products p
    WHERE p.collection_id = c.id AND p.is_featured = true AND p.is_active = true AND p.is_archived = false
  ) AS featured_products_count
FROM collections c;

-- ============================================
-- Helper functions
-- ============================================

-- Function to search products with full-text search
CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT,
  category_filter TEXT DEFAULT NULL,
  collection_filter UUID DEFAULT NULL,
  fulfillment_filter TEXT DEFAULT NULL,
  min_price NUMERIC DEFAULT NULL,
  max_price NUMERIC DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  slug TEXT,
  description TEXT,
  price NUMERIC,
  compare_at_price NUMERIC,
  image TEXT,
  category TEXT,
  collection_id UUID,
  fulfillment_type TEXT,
  stock_type TEXT,
  artist TEXT,
  tags TEXT[],
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.slug,
    p.short_description AS description,
    p.price,
    p.compare_at_price,
    p.image,
    p.category,
    p.collection_id,
    p.fulfillment_type,
    p.stock_type,
    p.artist,
    p.tags,
    ts_rank(p.search_vector, plainto_tsquery('portuguese', search_query)) AS rank
  FROM products p
  WHERE p.is_active = true
    AND p.is_archived = false
    AND (
      search_query IS NULL OR search_query = ''
      OR p.search_vector @@ plainto_tsquery('portuguese', search_query)
    )
    AND (category_filter IS NULL OR p.category = category_filter)
    AND (collection_filter IS NULL OR p.collection_id = collection_filter)
    AND (fulfillment_filter IS NULL OR p.fulfillment_type = fulfillment_filter)
    AND (min_price IS NULL OR p.price >= min_price)
    AND (max_price IS NULL OR p.price <= max_price)
  ORDER BY
    CASE WHEN search_query IS NULL OR search_query = '' THEN 0
         ELSE ts_rank(p.search_vector, plainto_tsquery('portuguese', search_query))
    END DESC,
    p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get order statistics
CREATE OR REPLACE FUNCTION get_order_stats(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_orders BIGINT,
  completed_orders BIGINT,
  pending_orders BIGINT,
  cancelled_orders BIGINT,
  gross_revenue NUMERIC,
  net_revenue NUMERIC,
  average_order_value NUMERIC,
  total_items_sold BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_orders,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT AS completed_orders,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_orders,
    COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT AS cancelled_orders,
    COALESCE(SUM(total), 0) AS gross_revenue,
    COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0) AS net_revenue,
    COALESCE(AVG(total), 0) AS average_order_value,
    COALESCE(SUM(oi.quantity), 0)::BIGINT AS total_items_sold
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  WHERE (start_date IS NULL OR o.created_at::date >= start_date)
    AND (end_date IS NULL OR o.created_at::date <= end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get product stock status
CREATE OR REPLACE FUNCTION get_product_stock_status(product_id_param BIGINT)
RETURNS TABLE (
  product_id BIGINT,
  product_name TEXT,
  stock_type TEXT,
  stock_quantity INTEGER,
  low_stock_threshold INTEGER,
  total_variants_stock INTEGER,
  is_low_stock BOOLEAN,
  is_out_of_stock BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.stock_type,
    p.stock_quantity,
    p.low_stock_threshold,
    COALESCE(
      (SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true),
      0
    ) AS total_variants_stock,
    p.stock_quantity <= p.low_stock_threshold AS is_low_stock,
    p.stock_quantity = 0 AND p.stock_type != 'print-on-demand' AS is_out_of_stock
  FROM products p
  WHERE p.id = product_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate shipping cost
CREATE OR REPLACE FUNCTION calculate_shipping_cost(
  items JSONB, -- [{product_id, quantity, weight}, ...]
  destination_cep TEXT
)
RETURNS JSONB AS $$
DECLARE
  state TEXT;
  zone_record RECORD;
  total_weight NUMERIC := 0;
  subtotal NUMERIC := 0;
  cost NUMERIC;
  result JSONB;
  item JSONB;
  item_weight NUMERIC;
  item_quantity INTEGER;
  item_price NUMERIC;
BEGIN
  -- Get state from CEP
  state := get_state_from_cep(destination_cep);

  IF state IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid CEP', 'cost', null, 'days', null);
  END IF;

  -- Get zone
  SELECT * INTO zone_record FROM get_zone_from_state(state);

  IF zone_record.zone_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No shipping zone found', 'cost', null, 'days', null);
  END IF;

  -- Calculate weight and subtotal from items
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    item_weight := COALESCE((item->>'weight')::NUMERIC, 0.3);
    item_quantity := (item->>'quantity')::INTEGER;
    item_price := COALESCE((item->>'price')::NUMERIC, 0);

    total_weight := total_weight + (item_weight * item_quantity);
    subtotal := subtotal + (item_price * item_quantity);
  END LOOP;

  -- Calculate cost
  cost := zone_record.base_cost + (CEIL(total_weight) * zone_record.per_kg_cost);

  -- Check free shipping threshold
  IF subtotal >= 200 THEN
    cost := 0;
  END IF;

  result := jsonb_build_object(
    'cost', cost,
    'days_min', zone_record.days_min,
    'days_max', zone_record.days_max,
    'weight_kg', total_weight,
    'subtotal', subtotal,
    'free_shipping_applied', cost = 0 AND subtotal >= 200
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record inventory movement
CREATE OR REPLACE FUNCTION record_inventory_movement(
  p_product_id BIGINT,
  p_variant_id BIGINT,
  p_movement_type TEXT,
  p_quantity INTEGER,
  p_order_id UUID DEFAULT NULL,
  p_order_item_id BIGINT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  previous_stock INTEGER;
  new_stock INTEGER;
  movement_id BIGINT;
BEGIN
  -- Get current stock
  SELECT stock_quantity INTO previous_stock
  FROM products
  WHERE id = p_product_id;

  -- Calculate new stock
  IF p_movement_type LIKE 'inbound%' THEN
    new_stock := COALESCE(previous_stock, 0) + p_quantity;
  ELSE
    new_stock := COALESCE(previous_stock, 0) - p_quantity;
  END IF;

  -- Insert movement record
  INSERT INTO inventory_movements (
    product_id,
    variant_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    order_id,
    order_item_id,
    notes
  ) VALUES (
    p_product_id,
    p_variant_id,
    p_movement_type,
    p_quantity,
    previous_stock,
    new_stock,
    p_order_id,
    p_order_item_id,
    p_notes
  ) RETURNING id INTO movement_id;

  -- Update product stock
  UPDATE products
  SET stock_quantity = new_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Update variant stock if applicable
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock_quantity = new_stock,
        updated_at = NOW()
    WHERE id = p_variant_id;
  END IF;

  RETURN movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
