-- Activity log: tracks all admin and player actions for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'player',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_name ON activity_log(actor_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'Service-layer access control'
  ) THEN
    CREATE POLICY "Service-layer access control" ON activity_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
