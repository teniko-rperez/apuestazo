-- Apuestazo Database Schema

-- API Usage tracking
CREATE TABLE api_usage (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  sport_key TEXT,
  markets TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_usage_created ON api_usage (created_at DESC);

-- Sports reference
CREATE TABLE sports (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO sports (key, name) VALUES
  ('basketball_nba', 'NBA'),
  ('baseball_mlb', 'MLB');

-- Bookmakers reference
CREATE TABLE bookmakers (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO bookmakers (key, name) VALUES
  ('draftkings', 'DraftKings'),
  ('fanduel', 'FanDuel'),
  ('betmgm', 'BetMGM'),
  ('williamhill_us', 'Caesars'),
  ('pointsbetus', 'PointsBet'),
  ('betrivers', 'BetRivers');

-- Events (games)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  sport_key TEXT NOT NULL REFERENCES sports(key),
  commence_time TIMESTAMPTZ NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_sport_time ON events (sport_key, commence_time DESC);
CREATE INDEX idx_events_commence ON events (commence_time);

-- Odds snapshots (historical)
CREATE TABLE odds_snapshots (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  bookmaker_key TEXT NOT NULL REFERENCES bookmakers(key),
  market_key TEXT NOT NULL,
  outcomes JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odds_event_market_time ON odds_snapshots (event_id, market_key, fetched_at DESC);
CREATE INDEX idx_odds_fetched ON odds_snapshots (fetched_at DESC);

-- Player props
CREATE TABLE player_props (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  bookmaker_key TEXT NOT NULL REFERENCES bookmakers(key),
  player_name TEXT NOT NULL,
  market_key TEXT NOT NULL,
  outcomes JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_props_event_player ON player_props (event_id, player_name, market_key);

-- Arbitrage opportunities
CREATE TABLE arbitrage_opportunities (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  market_key TEXT NOT NULL,
  profit_margin DECIMAL(8, 6) NOT NULL,
  legs JSONB NOT NULL,
  total_implied_probability DECIMAL(8, 6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_arb_status_profit ON arbitrage_opportunities (status, profit_margin DESC);

-- EV opportunities
CREATE TABLE ev_opportunities (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  market_key TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  bookmaker_key TEXT NOT NULL REFERENCES bookmakers(key),
  odds INTEGER NOT NULL,
  fair_odds INTEGER NOT NULL,
  edge_pct DECIMAL(8, 6) NOT NULL,
  kelly_fraction DECIMAL(8, 6) NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL CHECK (confidence IN ('alta', 'media', 'baja')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired'))
);

CREATE INDEX idx_ev_status_edge ON ev_opportunities (status, edge_pct DESC);

-- Recommendations
CREATE TABLE recommendations (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('arbitrage', 'ev', 'value', 'parlay_leg')),
  market_key TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  bookmaker_key TEXT NOT NULL REFERENCES bookmakers(key),
  odds INTEGER NOT NULL,
  reasoning TEXT NOT NULL,
  confidence_score DECIMAL(4, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);

CREATE INDEX idx_recommendations_time ON recommendations (created_at DESC);

-- Poll schedule
CREATE TABLE poll_schedule (
  id SERIAL PRIMARY KEY,
  sport_key TEXT NOT NULL REFERENCES sports(key) UNIQUE,
  next_poll_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  poll_interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_polled_at TIMESTAMPTZ,
  games_today INTEGER NOT NULL DEFAULT 0,
  is_game_day BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO poll_schedule (sport_key) VALUES ('basketball_nba'), ('baseball_mlb');

-- Enable RLS on all tables
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_schedule ENABLE ROW LEVEL SECURITY;

-- Anon (public) can read everything
CREATE POLICY "anon_read_events" ON events FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_odds" ON odds_snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_props" ON player_props FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_arb" ON arbitrage_opportunities FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_ev" ON ev_opportunities FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_recs" ON recommendations FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_schedule" ON poll_schedule FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_usage" ON api_usage FOR SELECT TO anon USING (true);

-- Service role has full access (default, but explicit)
CREATE POLICY "service_all_events" ON events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_odds" ON odds_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_props" ON player_props FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_arb" ON arbitrage_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_ev" ON ev_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_recs" ON recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_schedule" ON poll_schedule FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_usage" ON api_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
