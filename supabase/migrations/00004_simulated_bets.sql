CREATE TABLE IF NOT EXISTS simulated_bets (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  market_key TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  bookmaker_key TEXT NOT NULL,
  odds INTEGER NOT NULL,
  stake DECIMAL(10, 2) NOT NULL DEFAULT 100,
  source TEXT NOT NULL, -- 'arbitrage' | 'ev' | 'expert' | 'parlay'
  reasoning TEXT,
  result TEXT CHECK (result IN ('pending', 'won', 'lost', 'push')),
  profit DECIMAL(10, 2),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX idx_sim_bets_result ON simulated_bets (result, placed_at DESC);

ALTER TABLE simulated_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_sim_bets" ON simulated_bets FOR SELECT TO anon USING (true);
CREATE POLICY "service_all_sim_bets" ON simulated_bets FOR ALL TO service_role USING (true) WITH CHECK (true);
