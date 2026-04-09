CREATE TABLE IF NOT EXISTS learning_history (
  id BIGSERIAL PRIMARY KEY,
  config JSONB NOT NULL,
  signal_changes JSONB,
  bets_analyzed INTEGER NOT NULL DEFAULT 0,
  win_rate DECIMAL(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE learning_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_learning" ON learning_history FOR SELECT TO anon USING (true);
CREATE POLICY "service_all_learning" ON learning_history FOR ALL TO service_role USING (true) WITH CHECK (true);
