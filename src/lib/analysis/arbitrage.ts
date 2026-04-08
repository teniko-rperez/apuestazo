import { americanToDecimal, americanToImplied } from './implied-probability';
import type { LatestOdds } from '@/types/odds';
import type { ArbLeg } from '@/types/arbitrage';

export interface ArbResult {
  event_id: string;
  market_key: string;
  profit_margin: number;
  total_implied_probability: number;
  legs: ArbLeg[];
}

/**
 * Detect arbitrage opportunities for a specific event and market.
 * Finds the best odds for each outcome across all bookmakers,
 * then checks if the total implied probability < 1 (= guaranteed profit).
 */
export function detectArbitrage(
  eventId: string,
  marketKey: string,
  oddsRows: LatestOdds[]
): ArbResult | null {
  // Group by outcome name, find best odds per outcome
  const bestByOutcome = new Map<string, { bookmaker: string; odds: number; point?: number }>();

  for (const row of oddsRows) {
    for (const outcome of row.outcomes as Array<{ name: string; price: number; point?: number }>) {
      // For spreads/totals, include point in the key to avoid mixing lines
      const key = outcome.point != null
        ? `${outcome.name}|${outcome.point}`
        : outcome.name;

      const current = bestByOutcome.get(key);
      if (!current || outcome.price > current.odds) {
        bestByOutcome.set(key, {
          bookmaker: row.bookmaker_key,
          odds: outcome.price,
          point: outcome.point,
        });
      }
    }
  }

  if (bestByOutcome.size < 2) return null;

  // Calculate total implied probability using best odds
  const entries = Array.from(bestByOutcome.entries());
  const totalImplied = entries.reduce(
    (sum, [, { odds }]) => sum + americanToImplied(odds),
    0
  );

  // If total < 1, we have an arbitrage opportunity
  if (totalImplied >= 1) return null;

  const profitMargin = 1 - totalImplied;

  // Only report arbs with > 0.5% profit margin
  if (profitMargin < 0.005) return null;

  // Calculate optimal stake percentages for each leg
  const legs: ArbLeg[] = entries.map(([, { bookmaker, odds }]) => {
    const decimal = americanToDecimal(odds);
    const stakePct = (1 / decimal) / totalImplied;
    return {
      bookmaker,
      outcome_name: entries.find(([, v]) => v.bookmaker === bookmaker && v.odds === odds)?.[0].split('|')[0] ?? '',
      odds,
      stake_pct: stakePct,
    };
  });

  return {
    event_id: eventId,
    market_key: marketKey,
    profit_margin: profitMargin,
    total_implied_probability: totalImplied,
    legs,
  };
}

/**
 * Run arbitrage detection across all events and markets.
 */
export function findAllArbitrages(latestOdds: LatestOdds[]): ArbResult[] {
  // Group by event_id + market_key
  const groups = new Map<string, LatestOdds[]>();
  for (const row of latestOdds) {
    const key = `${row.event_id}|${row.market_key}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const arbs: ArbResult[] = [];
  for (const [key, rows] of groups) {
    const [eventId, marketKey] = key.split('|');
    const result = detectArbitrage(eventId, marketKey, rows);
    if (result) arbs.push(result);
  }

  return arbs.sort((a, b) => b.profit_margin - a.profit_margin);
}
