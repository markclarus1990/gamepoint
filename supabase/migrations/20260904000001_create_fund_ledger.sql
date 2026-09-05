-- Fund ledger: tracks gfunds (peso balance) changes per user
CREATE TABLE IF NOT EXISTS fund_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_ledger_user ON fund_ledger(user_id, created_at DESC);

ALTER TABLE fund_ledger ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fund_ledger' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON fund_ledger FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
