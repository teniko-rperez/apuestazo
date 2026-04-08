export interface Recommendation {
  id: number;
  event_id: string;
  type: 'arbitrage' | 'ev' | 'value' | 'parlay_leg';
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  reasoning: string;
  confidence_score: number;
  created_at: string;
  valid_until: string;
  event?: {
    home_team: string;
    away_team: string;
    commence_time: string;
    sport_key: string;
  };
}
