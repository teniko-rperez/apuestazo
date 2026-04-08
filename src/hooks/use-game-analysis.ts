"use client";

import useSWR from "swr";

export interface BetSignal {
  type: string;
  label: string;
  detail: string;
  strength: "strong" | "moderate" | "weak";
}

export interface BetAnalysis {
  outcome_name: string;
  market_key: string;
  market_label: string;
  best_odds: number;
  best_bookmaker: string;
  best_bookmaker_name: string;
  fair_probability: number;
  implied_probability: number;
  edge_pct: number | null;
  kelly_fraction: number | null;
  has_value: boolean;
  confidence: "alta" | "media" | "baja" | "none";
  odds_by_book: Array<{
    bookmaker_key: string;
    bookmaker_name: string;
    odds: number;
    is_best: boolean;
    point?: number;
  }>;
  signals: BetSignal[];
  recommendation: string | null;
}

export interface MarketAnalysis {
  market_key: string;
  market_label: string;
  has_arb: boolean;
  arb_profit: number | null;
  bets: BetAnalysis[];
}

export interface GameAnalysis {
  event_id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_key: string;
  completed: boolean;
  total_signals: number;
  best_bet: BetAnalysis | null;
  markets: MarketAnalysis[];
  expert_picks: Array<{
    expert_name: string;
    source: string;
    pick_description: string;
    confidence: string;
    record: string;
  }>;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch game analysis");
  return res.json();
};

export function useGameAnalysis(eventId: string) {
  return useSWR<GameAnalysis>(
    eventId ? `/api/game-analysis?eventId=${eventId}` : null,
    fetcher,
    { refreshInterval: 60000 }
  );
}
