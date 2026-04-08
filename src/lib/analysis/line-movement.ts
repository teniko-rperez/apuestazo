import type { OddsSnapshot } from '@/types/odds';

export interface LineMovement {
  event_id: string;
  market_key: string;
  bookmaker_key: string;
  outcome_name: string;
  previous_odds: number;
  current_odds: number;
  change: number;
  is_significant: boolean;
  direction: 'up' | 'down';
  detected_at: string;
}

export interface SteamMove {
  event_id: string;
  market_key: string;
  outcome_name: string;
  direction: 'up' | 'down';
  bookmakers_moving: string[];
  average_change: number;
}

const SIGNIFICANCE_THRESHOLDS: Record<string, number> = {
  h2h: 15, // 15 cents on moneyline
  spreads: 10, // 10 cents on spread odds (point change handled separately)
  totals: 10,
};

/**
 * Detect line movements by comparing current vs previous snapshots.
 */
export function detectLineMovements(
  currentSnapshots: OddsSnapshot[],
  previousSnapshots: OddsSnapshot[]
): LineMovement[] {
  const movements: LineMovement[] = [];

  // Index previous snapshots
  const prevMap = new Map<string, OddsSnapshot>();
  for (const snap of previousSnapshots) {
    const key = `${snap.event_id}|${snap.bookmaker_key}|${snap.market_key}`;
    prevMap.set(key, snap);
  }

  for (const current of currentSnapshots) {
    const key = `${current.event_id}|${current.bookmaker_key}|${current.market_key}`;
    const prev = prevMap.get(key);
    if (!prev) continue;

    const currentOutcomes = current.outcomes as Array<{ name: string; price: number }>;
    const prevOutcomes = prev.outcomes as Array<{ name: string; price: number }>;

    for (const curr of currentOutcomes) {
      const prevOutcome = prevOutcomes.find((o) => o.name === curr.name);
      if (!prevOutcome) continue;

      const change = curr.price - prevOutcome.price;
      if (change === 0) continue;

      const threshold = SIGNIFICANCE_THRESHOLDS[current.market_key] ?? 15;
      const isSignificant = Math.abs(change) >= threshold;

      movements.push({
        event_id: current.event_id,
        market_key: current.market_key,
        bookmaker_key: current.bookmaker_key,
        outcome_name: curr.name,
        previous_odds: prevOutcome.price,
        current_odds: curr.price,
        change,
        is_significant: isSignificant,
        direction: change > 0 ? 'up' : 'down',
        detected_at: current.fetched_at,
      });
    }
  }

  return movements;
}

/**
 * Detect steam moves: 3+ bookmakers moving in the same direction
 * for the same outcome within the same poll cycle.
 */
export function detectSteamMoves(movements: LineMovement[]): SteamMove[] {
  // Group by event + market + outcome + direction
  const groups = new Map<string, LineMovement[]>();
  for (const m of movements) {
    if (!m.is_significant) continue;
    const key = `${m.event_id}|${m.market_key}|${m.outcome_name}|${m.direction}`;
    const group = groups.get(key) ?? [];
    group.push(m);
    groups.set(key, group);
  }

  const steams: SteamMove[] = [];
  for (const [key, group] of groups) {
    if (group.length >= 3) {
      const [eventId, marketKey, outcomeName, direction] = key.split('|');
      steams.push({
        event_id: eventId,
        market_key: marketKey,
        outcome_name: outcomeName,
        direction: direction as 'up' | 'down',
        bookmakers_moving: group.map((m) => m.bookmaker_key),
        average_change: group.reduce((s, m) => s + m.change, 0) / group.length,
      });
    }
  }

  return steams;
}
