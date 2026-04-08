export interface ArbLeg {
  bookmaker: string;
  outcome_name: string;
  odds: number;
  stake_pct: number;
}

export interface ArbitrageOpportunity {
  id: number;
  event_id: string;
  market_key: string;
  profit_margin: number;
  legs: ArbLeg[];
  total_implied_probability: number;
  status: 'active' | 'expired';
  detected_at: string;
  expires_at: string;
  event?: {
    home_team: string;
    away_team: string;
    commence_time: string;
    sport_key: string;
  };
}

export interface EvOpportunity {
  id: number;
  event_id: string;
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  fair_odds: number;
  edge_pct: number;
  confidence: 'alta' | 'media' | 'baja';
  kelly_fraction: number;
  detected_at: string;
  status: 'active' | 'expired';
  event?: {
    home_team: string;
    away_team: string;
    commence_time: string;
    sport_key: string;
  };
}
