-- Migration: 005_create_categories
-- Description: Creates categories table for product categorization (livros, camisetas, posters, etc.)

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, -- slug as ID (e.g., 'livros', 'camisetas')
  name TEXT NOT NULL,
  icon TEXT, -- emoji or icon identifier
  description TEXT,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL, -- for hierarchical categories
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_collection_id ON categories(collection_id);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- Seed initial categories
INSERT INTO categories (id, name, icon, sort_order) VALUES
  ('todos', 'Todos', '🏪', 0),
  ('livros', 'Livros', '📚', 1),
  ('camisetas', 'Camisetas', '👕', 2),
  ('posters', 'Posters', '🖼️', 3),
  ('acessorios', 'Acessórios', '💎', 4),
  ('canecas', 'Canecas', '☕', 5),
  ('bolsas', 'Bolsas', '👜', 6),
  ('artes', 'Artes', '🎨', 7),
  ('digitais', 'Digitais', '💻', 8),
  ('outros', 'Outros', '📦', 9),
  ('parceiros', 'Parceiros', '🤝', 10)
ON CONFLICT (id) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
