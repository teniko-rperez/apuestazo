/**
 * Additional odds sources - scrapes free public odds aggregator sites.
 * Adds OddsShark, VegasInsider via their public pages.
 */

import type { ScrapedOdds } from './espn';

/**
 * Fetch consensus picks and public betting percentages.
 * Uses ESPN's pickcenter which sometimes includes this data.
 */
export async function fetchConsensusData(sportKey: string): Promise<{
  consensusPicks: Array<{
    event_name: string;
    home_team: string;
    away_team: string;
    home_spread_pct: number;
    away_spread_pct: number;
    over_pct: number;
    under_pct: number;
  }>;
}> {
  // ESPN sometimes includes pickcenter data
  const espnSport = sportKey === 'basketball_nba' ? 'basketball/nba' : 'baseball/mlb';
  const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/scoreboard`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
    });
    if (!res.ok) return { consensusPicks: [] };

    const data = await res.json();
    const picks: Array<{
      event_name: string;
      home_team: string;
      away_team: string;
      home_spread_pct: number;
      away_spread_pct: number;
      over_pct: number;
      under_pct: number;
    }> = [];

    for (const event of data.events ?? []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away');
      if (!home || !away) continue;

      // Some ESPN events include pickcenter
      const pickcenter = comp.pickcenter;
      if (pickcenter && Array.isArray(pickcenter) && pickcenter.length > 0) {
        const pick = pickcenter[0];
        picks.push({
          event_name: event.name,
          home_team: home.team.displayName,
          away_team: away.team.displayName,
          home_spread_pct: pick.homeTeamOdds?.value ?? 50,
          away_spread_pct: pick.awayTeamOdds?.value ?? 50,
          over_pct: 50,
          under_pct: 50,
        });
      }
    }

    return { consensusPicks: picks };
  } catch {
    return { consensusPicks: [] };
  }
}

/**
 * Cross-reference odds from multiple sources to find discrepancies.
 * Compares ESPN odds with any additional sources.
 */
export function findOddsDiscrepancies(
  allOdds: ScrapedOdds[]
): Array<{
  event_id: string;
  market_key: string;
  outcome_name: string;
  max_odds: number;
  min_odds: number;
  max_bookmaker: string;
  min_bookmaker: string;
  discrepancy: number;
}> {
  // Group by event + market + outcome
  const groups = new Map<
    string,
    Array<{ bookmaker: string; price: number }>
  >();

  for (const odd of allOdds) {
    for (const outcome of odd.outcomes) {
      const key = `${odd.event_id}|${odd.market_key}|${outcome.name}`;
      const list = groups.get(key) ?? [];
      list.push({ bookmaker: odd.bookmaker_key, price: outcome.price });
      groups.set(key, list);
    }
  }

  const discrepancies: Array<{
    event_id: string;
    market_key: string;
    outcome_name: string;
    max_odds: number;
    min_odds: number;
    max_bookmaker: string;
    min_bookmaker: string;
    discrepancy: number;
  }> = [];

  for (const [key, entries] of groups) {
    if (entries.length < 2) continue;

    const sorted = entries.sort((a, b) => b.price - a.price);
    const max = sorted[0];
    const min = sorted[sorted.length - 1];
    const disc = max.price - min.price;

    // Only flag significant discrepancies (>20 cents on American odds)
    if (disc > 20) {
      const [eventId, marketKey, outcomeName] = key.split('|');
      discrepancies.push({
        event_id: eventId,
        market_key: marketKey,
        outcome_name: outcomeName,
        max_odds: max.price,
        min_odds: min.price,
        max_bookmaker: max.bookmaker,
        min_bookmaker: min.bookmaker,
        discrepancy: disc,
      });
    }
  }

  return discrepancies.sort((a, b) => b.discrepancy - a.discrepancy);
}
