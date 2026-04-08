-- Expert picks table
CREATE TABLE IF NOT EXISTS expert_picks (
  id BIGSERIAL PRIMARY KEY,
  expert_name TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  sport TEXT NOT NULL,
  pick_type TEXT NOT NULL,
  pick_description TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('alta', 'media', 'baja')),
  record TEXT,
  profit_units DECIMAL(10, 2),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expert_picks_sport ON expert_picks (sport, scraped_at DESC);
CREATE INDEX idx_expert_picks_source ON expert_picks (source, scraped_at DESC);

ALTER TABLE expert_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_expert_picks" ON expert_picks FOR SELECT TO anon USING (true);
CREATE POLICY "service_all_expert_picks" ON expert_picks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Also add espnbet to bookmakers if not exists
INSERT INTO bookmakers (key, name) VALUES ('espnbet', 'ESPN BET') ON CONFLICT (key) DO NOTHING;
