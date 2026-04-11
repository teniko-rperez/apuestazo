-- Expand recommendation types to include engine-generated categories
-- Previously the engine silently rewrote 'steam' and 'expert' to 'value'
-- to satisfy the CHECK constraint, losing signal provenance.
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_type_check;
ALTER TABLE recommendations ADD CONSTRAINT recommendations_type_check
  CHECK (type IN ('arbitrage', 'ev', 'value', 'parlay_leg', 'steam', 'expert', 'favorite'));
