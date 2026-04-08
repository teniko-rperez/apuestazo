CREATE TABLE IF NOT EXISTS robinhood_contracts (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  event_ticker TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  yes_price INTEGER,
  no_price INTEGER,
  volume INTEGER DEFAULT 0,
  open_interest INTEGER DEFAULT 0,
  legs JSONB,
  sport TEXT NOT NULL,
  implied_prob DECIMAL(5, 4),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rh_sport ON robinhood_contracts (sport, scraped_at DESC);
ALTER TABLE robinhood_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_rh" ON robinhood_contracts FOR SELECT TO anon USING (true);
CREATE POLICY "service_all_rh" ON robinhood_contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
