import { americanToDecimal } from './implied-probability';
import type { EvResult } from './expected-value';

export interface ParlayLeg {
  event_id: string;
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  edge_pct: number;
}

export interface ParlayCombo {
  legs: ParlayLeg[];
  combined_odds: number;
  combined_edge: number;
  bookmaker_key: string;
}

/**
 * Build optimal parlays from +EV opportunities.
 * Only combines uncorrelated legs (different events).
 * Prefers legs from the same bookmaker for actual parlay placement.
 */
export function buildParlays(evOpportunities: EvResult[]): ParlayCombo[] {
  if (evOpportunities.length < 2) return [];

  // Group by bookmaker to build same-book parlays
  const byBook = new Map<string, EvResult[]>();
  for (const ev of evOpportunities) {
    const list = byBook.get(ev.bookmaker_key) ?? [];
    list.push(ev);
    byBook.set(ev.bookmaker_key, list);
  }

  const parlays: ParlayCombo[] = [];

  for (const [bookmaker, evs] of byBook) {
    // Only use distinct events
    const uniqueEvents = new Map<string, EvResult>();
    for (const ev of evs) {
      if (!uniqueEvents.has(ev.event_id)) {
        uniqueEvents.set(ev.event_id, ev);
      }
    }

    const legs = Array.from(uniqueEvents.values());
    if (legs.length < 2) continue;

    // Generate 2-leg parlays
    for (let i = 0; i < legs.length && i < 5; i++) {
      for (let j = i + 1; j < legs.length && j < 5; j++) {
        const combo = [legs[i], legs[j]];
        const combinedDecimal = combo.reduce(
          (acc, l) => acc * americanToDecimal(l.odds),
          1
        );
        const combinedEdge = combo.reduce((acc, l) => acc * (1 + l.edge_pct), 1) - 1;

        parlays.push({
          legs: combo.map((l) => ({
            event_id: l.event_id,
            market_key: l.market_key,
            outcome_name: l.outcome_name,
            bookmaker_key: l.bookmaker_key,
            odds: l.odds,
            edge_pct: l.edge_pct,
          })),
          combined_odds: Math.round((combinedDecimal - 1) * 100), // Convert to American
          combined_edge: combinedEdge,
          bookmaker_key: bookmaker,
        });
      }
    }

    // Generate 3-leg parlays (top 3 legs only)
    if (legs.length >= 3) {
      const top3 = legs.slice(0, 3);
      const combinedDecimal = top3.reduce(
        (acc, l) => acc * americanToDecimal(l.odds),
        1
      );
      const combinedEdge = top3.reduce((acc, l) => acc * (1 + l.edge_pct), 1) - 1;

      parlays.push({
        legs: top3.map((l) => ({
          event_id: l.event_id,
          market_key: l.market_key,
          outcome_name: l.outcome_name,
          bookmaker_key: l.bookmaker_key,
          odds: l.odds,
          edge_pct: l.edge_pct,
        })),
        combined_odds: Math.round((combinedDecimal - 1) * 100),
        combined_edge: combinedEdge,
        bookmaker_key: bookmaker,
      });
    }
  }

  return parlays.sort((a, b) => b.combined_edge - a.combined_edge).slice(0, 5);
}
