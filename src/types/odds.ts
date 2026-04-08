export interface Outcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsSnapshot {
  id: number;
  event_id: string;
  bookmaker_key: string;
  market_key: string;
  outcomes: Outcome[];
  fetched_at: string;
}

export interface LatestOdds {
  event_id: string;
  bookmaker_key: string;
  market_key: string;
  outcomes: Outcome[];
  fetched_at: string;
}

export interface PlayerProp {
  id: number;
  event_id: string;
  bookmaker_key: string;
  player_name: string;
  market_key: string;
  outcomes: Outcome[];
  fetched_at: string;
}

export interface BestOdds {
  outcome_name: string;
  best_price: number;
  best_bookmaker: string;
  all_prices: Record<string, number>;
  point?: number;
}
