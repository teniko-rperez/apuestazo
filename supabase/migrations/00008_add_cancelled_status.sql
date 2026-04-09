-- Add 'cancelled' as valid result status
ALTER TABLE simulated_bets DROP CONSTRAINT IF EXISTS simulated_bets_result_check;
ALTER TABLE simulated_bets ADD CONSTRAINT simulated_bets_result_check CHECK (result IN ('pending', 'won', 'lost', 'push', 'cancelled'));
