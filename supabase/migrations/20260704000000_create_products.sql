-- Products table for marketplace shop
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Product purchases tracking
CREATE TABLE IF NOT EXISTS product_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_purchases_user ON product_purchases(user_id, created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service-layer access control" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service-layer access control" ON product_purchases FOR ALL USING (true) WITH CHECK (true);

-- Seed products
INSERT INTO products (name, points_cost, image_url) VALUES
  ('Coke', 150, '/api/products/image?name=Coke&color=%23dc2626'),
  ('Twist_O', 120, '/api/products/image?name=Twist_O&color=%23d97706'),
  ('PancitCanton', 250, '/api/products/image?name=PancitCanton&color=%23ea580c'),
  ('Popcorn', 30, '/api/products/image?name=Popcorn&color=%23ca8a04'),
  ('IceJuice', 30, '/api/products/image?name=IceJuice&color=%230891b2'),
  ('Palamig', 30, '/api/products/image?name=Palamig&color=%232563eb')
ON CONFLICT DO NOTHING;
