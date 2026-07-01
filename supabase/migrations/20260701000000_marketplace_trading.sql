-- ============================================================
-- Marketplace Trading System
-- Adds: escrow, auctions, transactions, point ledger, saved listings
-- ============================================================

-- 1. POINT LEDGER
CREATE TABLE IF NOT EXISTS point_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'earned', 'redeemed', 'reserved', 'released',
    'purchased', 'sold', 'admin_adjustment'
  )),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON point_ledger(user_id, created_at DESC);

-- 2. Add reserved_points to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved_points INTEGER NOT NULL DEFAULT 0;

-- 3. Modify marketplace_posts
ALTER TABLE marketplace_posts ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'fixed_price'
  CHECK (listing_type IN ('fixed_price', 'auction'));

ALTER TABLE marketplace_posts ADD COLUMN IF NOT EXISTS starting_bid INTEGER;
ALTER TABLE marketplace_posts ADD COLUMN IF NOT EXISTS min_increment INTEGER;
ALTER TABLE marketplace_posts ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE marketplace_posts ADD COLUMN IF NOT EXISTS reserve_price INTEGER;
ALTER TABLE marketplace_posts ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES users(id);
ALTER TABLE marketplace_posts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Migrate existing data BEFORE changing the constraint
UPDATE marketplace_posts SET status = 'active' WHERE status IN ('available', 'reserved');
UPDATE marketplace_posts SET listing_type = 'fixed_price' WHERE listing_type IS NULL;

-- Update status constraint
ALTER TABLE marketplace_posts DROP CONSTRAINT IF EXISTS marketplace_posts_status_check;
ALTER TABLE marketplace_posts ADD CONSTRAINT marketplace_posts_status_check
  CHECK (status IN ('active', 'completed', 'cancelled', 'expired'));

-- 4. Bids table
CREATE TABLE IF NOT EXISTS bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bids_listing_amount ON bids(listing_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_bids_user ON bids(user_id, created_at DESC);

-- 5. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  points_amount INTEGER NOT NULL CHECK (points_amount > 0),
  price INTEGER NOT NULL CHECK (price >= 0),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('fixed_price', 'auction')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_listing ON transactions(listing_id);

-- 6. Saved listings
CREATE TABLE IF NOT EXISTS saved_listings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

-- RLS (permissive — access control in service layer)
ALTER TABLE point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service-layer access control" ON point_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service-layer access control" ON bids FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service-layer access control" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service-layer access control" ON saved_listings FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- ATOMIC RPC FUNCTIONS
-- ============================================================

-- Reserve points (check available >= amount, update reserved_points, write ledger)
CREATE OR REPLACE FUNCTION reserve_points(
  p_user_id UUID,
  p_amount INT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
  v_available INT;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_available := v_user.points - COALESCE(v_user.reserved_points, 0);
  IF v_available < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient available points', 'available', v_available, 'required', p_amount);
  END IF;

  UPDATE users SET reserved_points = COALESCE(reserved_points, 0) + p_amount WHERE id = p_user_id;

  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (p_user_id, 'reserved', p_amount, v_user.points, v_user.points, 'marketplace_listing', p_reference_id, COALESCE(p_description, 'Points reserved for marketplace listing'));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Release reserved points back to available
CREATE OR REPLACE FUNCTION release_points(
  p_user_id UUID,
  p_amount INT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.reserved_points, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot release more than reserved', 'reserved', v_user.reserved_points, 'requested', p_amount);
  END IF;

  UPDATE users SET reserved_points = reserved_points - p_amount WHERE id = p_user_id;

  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (p_user_id, 'released', -p_amount, v_user.points, v_user.points, 'marketplace_listing', p_reference_id, COALESCE(p_description, 'Points released from marketplace listing'));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Transfer points from seller to buyer (handles reserved release + purchase)
CREATE OR REPLACE FUNCTION transfer_points(
  p_seller_id UUID,
  p_buyer_id UUID,
  p_amount INT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_seller RECORD;
  v_buyer RECORD;
BEGIN
  SELECT * INTO v_seller FROM users WHERE id = p_seller_id FOR UPDATE;
  SELECT * INTO v_buyer FROM users WHERE id = p_buyer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seller not found');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Buyer not found');
  END IF;

  IF COALESCE(v_seller.reserved_points, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seller does not have enough reserved points');
  END IF;

  -- Release from seller's reserved
  UPDATE users SET reserved_points = reserved_points - p_amount WHERE id = p_seller_id;
  -- Add to buyer's balance
  UPDATE users SET points = points + p_amount WHERE id = p_buyer_id;

  -- Ledger: seller (sold)
  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (p_seller_id, 'sold', -p_amount, v_seller.points, v_seller.points - p_amount, 'marketplace_transaction', p_reference_id, COALESCE(p_description, 'Points sold in marketplace'));

  -- Ledger: buyer (purchased)
  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (p_buyer_id, 'purchased', p_amount, v_buyer.points, v_buyer.points + p_amount, 'marketplace_transaction', p_reference_id, COALESCE(p_description, 'Points purchased in marketplace'));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Complete a fixed-price purchase atomically
CREATE OR REPLACE FUNCTION complete_fixed_price_purchase(
  p_listing_id UUID,
  p_buyer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_listing RECORD;
  v_seller RECORD;
  v_buyer RECORD;
  v_transaction_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_listing FROM marketplace_posts WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  IF v_listing.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is not active');
  END IF;

  IF v_listing.listing_type <> 'fixed_price' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is not fixed price');
  END IF;

  IF v_listing.user_id = p_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot buy your own listing');
  END IF;

  SELECT * INTO v_seller FROM users WHERE id = v_listing.user_id FOR UPDATE;
  SELECT * INTO v_buyer FROM users WHERE id = p_buyer_id FOR UPDATE;

  IF COALESCE(v_seller.reserved_points, 0) < v_listing.points_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seller no longer has enough reserved points');
  END IF;

  -- Release seller reserved + add to buyer
  UPDATE users SET reserved_points = reserved_points - v_listing.points_amount WHERE id = v_seller.id;
  UPDATE users SET points = points + v_listing.points_amount WHERE id = v_buyer.id;

  -- Update listing
  UPDATE marketplace_posts
  SET status = 'completed', buyer_id = p_buyer_id, completed_at = v_now, updated_at = v_now
  WHERE id = p_listing_id;

  -- Transaction record
  INSERT INTO transactions (listing_id, seller_id, buyer_id, points_amount, price, listing_type, status, created_at, completed_at)
  VALUES (p_listing_id, v_listing.user_id, p_buyer_id, v_listing.points_amount, v_listing.asking_price, 'fixed_price', 'completed', v_now, v_now)
  RETURNING id INTO v_transaction_id;

  -- Ledger: seller
  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_seller.id, 'sold', -v_listing.points_amount, v_seller.points, v_seller.points - v_listing.points_amount, 'marketplace_transaction', v_transaction_id, 'Points sold in fixed price listing');

  -- Ledger: buyer
  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_buyer.id, 'purchased', v_listing.points_amount, v_buyer.points, v_buyer.points + v_listing.points_amount, 'marketplace_transaction', v_transaction_id, 'Points purchased in fixed price listing');

  RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$ LANGUAGE plpgsql;

-- Complete an auction atomically
CREATE OR REPLACE FUNCTION complete_auction(
  p_listing_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_listing RECORD;
  v_winning_bid RECORD;
  v_seller RECORD;
  v_buyer RECORD;
  v_transaction_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_listing FROM marketplace_posts WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  IF v_listing.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is not active');
  END IF;

  IF v_listing.listing_type <> 'auction' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is not an auction');
  END IF;

  -- Find winning bid (highest amount)
  SELECT * INTO v_winning_bid FROM bids
  WHERE listing_id = p_listing_id
  ORDER BY amount DESC
  LIMIT 1
  FOR UPDATE;

  -- If no bids, mark as expired
  IF v_winning_bid IS NULL THEN
    UPDATE marketplace_posts SET status = 'expired', updated_at = v_now WHERE id = p_listing_id;
    -- Release seller's reserved points
    SELECT * INTO v_seller FROM users WHERE id = v_listing.user_id FOR UPDATE;
    IF COALESCE(v_seller.reserved_points, 0) >= v_listing.points_amount THEN
      UPDATE users SET reserved_points = reserved_points - v_listing.points_amount WHERE id = v_seller.id;
      INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
      VALUES (v_seller.id, 'released', -v_listing.points_amount, v_seller.points, v_seller.points, 'marketplace_listing', p_listing_id, 'Points released from expired auction (no bids)');
    END IF;
    RETURN jsonb_build_object('success', true, 'status', 'expired', 'reason', 'no_bids');
  END IF;

  -- Check reserve price
  IF v_listing.reserve_price IS NOT NULL AND v_winning_bid.amount < v_listing.reserve_price THEN
    UPDATE marketplace_posts SET status = 'expired', updated_at = v_now WHERE id = p_listing_id;
    -- Release seller's reserved points
    SELECT * INTO v_seller FROM users WHERE id = v_listing.user_id FOR UPDATE;
    IF COALESCE(v_seller.reserved_points, 0) >= v_listing.points_amount THEN
      UPDATE users SET reserved_points = reserved_points - v_listing.points_amount WHERE id = v_seller.id;
      INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
      VALUES (v_seller.id, 'released', -v_listing.points_amount, v_seller.points, v_seller.points, 'marketplace_listing', p_listing_id, 'Points released from expired auction (reserve not met)');
    END IF;
    RETURN jsonb_build_object('success', true, 'status', 'expired', 'reason', 'reserve_not_met');
  END IF;

  -- Complete sale to winner
  SELECT * INTO v_seller FROM users WHERE id = v_listing.user_id FOR UPDATE;
  SELECT * INTO v_buyer FROM users WHERE id = v_winning_bid.user_id FOR UPDATE;

  IF COALESCE(v_seller.reserved_points, 0) < v_listing.points_amount THEN
    UPDATE marketplace_posts SET status = 'expired', updated_at = v_now WHERE id = p_listing_id;
    RETURN jsonb_build_object('success', false, 'error', 'Seller no longer has enough reserved points');
  END IF;

  -- Transfer points
  UPDATE users SET reserved_points = reserved_points - v_listing.points_amount WHERE id = v_seller.id;
  UPDATE users SET points = points + v_listing.points_amount WHERE id = v_buyer.id;

  -- Update listing
  UPDATE marketplace_posts
  SET status = 'completed', buyer_id = v_buyer.id, completed_at = v_now, updated_at = v_now
  WHERE id = p_listing_id;

  -- Transaction record
  INSERT INTO transactions (listing_id, seller_id, buyer_id, points_amount, price, listing_type, status, created_at, completed_at)
  VALUES (p_listing_id, v_listing.user_id, v_buyer.id, v_listing.points_amount, v_winning_bid.amount, 'auction', 'completed', v_now, v_now)
  RETURNING id INTO v_transaction_id;

  -- Ledger: seller
  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_seller.id, 'sold', -v_listing.points_amount, v_seller.points, v_seller.points - v_listing.points_amount, 'marketplace_transaction', v_transaction_id, 'Points sold in auction');

  -- Ledger: buyer
  INSERT INTO point_ledger (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_buyer.id, 'purchased', v_listing.points_amount, v_buyer.points, v_buyer.points + v_listing.points_amount, 'marketplace_transaction', v_transaction_id, 'Points purchased in auction');

  RETURN jsonb_build_object('success', true, 'status', 'completed', 'transaction_id', v_transaction_id, 'winner_id', v_buyer.id, 'winning_bid', v_winning_bid.amount);
END;
$$ LANGUAGE plpgsql;
