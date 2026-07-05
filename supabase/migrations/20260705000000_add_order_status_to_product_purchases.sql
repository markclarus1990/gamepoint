ALTER TABLE product_purchases
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'granted')),
ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ;
