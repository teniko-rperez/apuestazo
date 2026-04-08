-- Materialized view for latest odds (fast reads)
CREATE MATERIALIZED VIEW latest_odds AS
SELECT DISTINCT ON (event_id, bookmaker_key, market_key)
  event_id,
  bookmaker_key,
  market_key,
  outcomes,
  fetched_at
FROM odds_snapshots
ORDER BY event_id, bookmaker_key, market_key, fetched_at DESC;

CREATE UNIQUE INDEX idx_latest_odds_pk ON latest_odds (event_id, bookmaker_key, market_key);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_latest_odds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_odds;
END;
$$;

-- Function to expire old opportunities
CREATE OR REPLACE FUNCTION expire_old_opportunities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Expire arb opportunities for events that have started
  UPDATE arbitrage_opportunities
  SET status = 'expired'
  WHERE status = 'active'
    AND event_id IN (
      SELECT id FROM events WHERE commence_time < NOW()
    );

  -- Expire EV opportunities for events that have started
  UPDATE ev_opportunities
  SET status = 'expired'
  WHERE status = 'active'
    AND event_id IN (
      SELECT id FROM events WHERE commence_time < NOW()
    );
END;
$$;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete snapshots older than 7 days
  DELETE FROM odds_snapshots WHERE fetched_at < NOW() - INTERVAL '7 days';

  -- Delete expired opportunities older than 3 days
  DELETE FROM arbitrage_opportunities
  WHERE status = 'expired' AND detected_at < NOW() - INTERVAL '3 days';

  DELETE FROM ev_opportunities
  WHERE status = 'expired' AND detected_at < NOW() - INTERVAL '3 days';

  -- Delete old recommendations
  DELETE FROM recommendations WHERE valid_until < NOW() - INTERVAL '3 days';

  -- Delete old props
  DELETE FROM player_props WHERE fetched_at < NOW() - INTERVAL '7 days';

  -- Delete completed events older than 7 days
  DELETE FROM events WHERE completed = TRUE AND commence_time < NOW() - INTERVAL '7 days';

  -- Delete old api usage records (keep 60 days)
  DELETE FROM api_usage WHERE created_at < NOW() - INTERVAL '60 days';
END;
$$;

-- Function to get remaining API credits this month
CREATE OR REPLACE FUNCTION get_remaining_credits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  used INTEGER;
BEGIN
  SELECT COALESCE(SUM(credits_used), 0) INTO used
  FROM api_usage
  WHERE created_at >= DATE_TRUNC('month', NOW());
  RETURN 500 - used;
END;
$$;
