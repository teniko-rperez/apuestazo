import {
  americanToDecimal,
  americanToImplied,
  powerDevig,
  kellyFraction,
  decimalToAmerican,
} from './implied-probability';
import type { LatestOdds } from '@/types/odds';

export interface EvResult {
  event_id: string;
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  fair_odds: number;
  edge_pct: number;
  kelly_fraction: number;
  confidence: 'alta' | 'media' | 'baja';
}

/**
 * Detect +EV (positive expected value) opportunities.
 * Uses power devig on consensus (average) odds to find fair probabilities,
 * then compares each bookmaker's odds against the fair line.
 */
export function detectEv(
  eventId: string,
  marketKey: string,
  oddsRows: LatestOdds[]
): EvResult[] {
  if (oddsRows.length < 2) return [];

  // Collect all odds per outcome from all bookmakers
  const outcomeOdds = new Map<string, { bookmaker: string; odds: number }[]>();

  for (const row of oddsRows) {
    for (const outcome of row.outcomes as Array<{ name: string; price: number }>) {
      const list = outcomeOdds.get(outcome.name) ?? [];
      list.push({ bookmaker: row.bookmaker_key, odds: outcome.price });
      outcomeOdds.set(outcome.name, list);
    }
  }

  if (outcomeOdds.size < 2) return [];

  // Calculate consensus (average) odds per outcome
  const outcomeNames = Array.from(outcomeOdds.keys());
  const avgOdds = outcomeNames.map((name) => {
    const prices = outcomeOdds.get(name)!.map((o) => o.odds);
    // Average in implied probability space (more accurate)
    const avgImplied = prices.length > 0
      ? prices.reduce((s, o) => s + americanToImplied(o), 0) / prices.length
      : 0.5;
    // Convert back to American
    return avgImplied > 0.5
      ? -Math.round((avgImplied / (1 - avgImplied)) * 100)
      : Math.round(((1 - avgImplied) / avgImplied) * 100);
  });

  // Power devig to get fair probabilities
  const fairProbs = powerDevig(avgOdds);

  const results: EvResult[] = [];

  // Check each bookmaker's line against fair probabilities
  for (let i = 0; i < outcomeNames.length; i++) {
    const outcomeName = outcomeNames[i];
    const fairProb = fairProbs[i];
    const fairDecimal = 1 / fairProb;
    const fairAmerican = decimalToAmerican(fairDecimal);

    const bookEntries = outcomeOdds.get(outcomeName)!;

    for (const { bookmaker, odds } of bookEntries) {
      const decimal = americanToDecimal(odds);
      const edge = fairProb * decimal - 1;

      if (edge > 0.02) {
        // > 2% edge
        const confidence: 'alta' | 'media' | 'baja' =
          edge > 0.05 ? 'alta' : edge > 0.03 ? 'media' : 'baja';

        results.push({
          event_id: eventId,
          market_key: marketKey,
          outcome_name: outcomeName,
          bookmaker_key: bookmaker,
          odds,
          fair_odds: fairAmerican,
          edge_pct: edge,
          kelly_fraction: kellyFraction(edge, decimal),
          confidence,
        });
      }
    }
  }

  return results.sort((a, b) => b.edge_pct - a.edge_pct);
}

/**
 * Run EV detection across all events and markets.
 */
export function findAllEvOpportunities(latestOdds: LatestOdds[]): EvResult[] {
  const groups = new Map<string, LatestOdds[]>();
  for (const row of latestOdds) {
    const key = `${row.event_id}|${row.market_key}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const allResults: EvResult[] = [];
  for (const [key, rows] of groups) {
    const [eventId, marketKey] = key.split('|');
    const results = detectEv(eventId, marketKey, rows);
    allResults.push(...results);
  }

  return allResults.sort((a, b) => b.edge_pct - a.edge_pct);
}
