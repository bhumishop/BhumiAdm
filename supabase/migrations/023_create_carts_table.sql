-- Migration 023: Create carts and cart_items tables for server-side cart sync
-- This enables cart persistence across devices and sessions

-- ============================================
-- Cart table
-- ============================================
CREATE TABLE IF NOT EXISTS carts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_cart_has_owner CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);

-- Index for fast cart lookup
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_anonymous_id ON carts(anonymous_id) WHERE anonymous_id IS NOT NULL;

-- ============================================
-- Cart items table
-- ============================================
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT REFERENCES carts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL,
  product_name TEXT NOT NULL,
  product_price NUMERIC(10,2) NOT NULL CHECK (product_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  size TEXT,
  fulfillment_type TEXT DEFAULT 'custom',
  weight NUMERIC(10,3) DEFAULT 0.3,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast cart item lookup
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- Unique constraint to prevent duplicate items in same cart (product + size)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique
  ON cart_items(cart_id, product_id, COALESCE(size, 'default'));

-- ============================================
-- Checkout redirects audit table
-- ============================================
CREATE TABLE IF NOT EXISTS checkout_redirects (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  anonymous_id TEXT,
  redirect_type TEXT NOT NULL, -- 'uma_penca', etc.
  items_count INTEGER DEFAULT 0,
  token_jti TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_redirects_user_id ON checkout_redirects(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_redirects_created ON checkout_redirects(created_at DESC);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_redirects ENABLE ROW LEVEL SECURITY;

-- Carts policies
-- Users can only see their own carts (authenticated)
CREATE POLICY "Users can view own carts" ON carts
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own carts
CREATE POLICY "Users can create own carts" ON carts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own carts
CREATE POLICY "Users can update own carts" ON carts
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own carts
CREATE POLICY "Users can delete own carts" ON carts
  FOR DELETE USING (user_id = auth.uid());

-- Anonymous carts - only accessible via matching anonymous_id (handled by edge function with service role)
CREATE POLICY "Anonymous users can view own carts" ON carts
  FOR SELECT USING (anonymous_id IS NOT NULL);

-- Cart items policies - managed via edge function (service role)
-- Authenticated users can view items in their carts
CREATE POLICY "Users can view cart items via cart ownership" ON cart_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid())
  );

-- Cart items are managed by edge function with service role key

-- Checkout redirects policies
CREATE POLICY "Users can view own redirects" ON checkout_redirects
  FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- Cleanup old carts (auto-vacuum friendly)
-- ============================================
-- Function to clean up carts older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_carts()
RETURNS void AS $$
BEGIN
  DELETE FROM carts
  WHERE user_id IS NULL
    AND updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
