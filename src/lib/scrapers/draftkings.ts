/**
 * DraftKings public sportsbook scraper - No auth required.
 * Uses their public-facing API endpoints.
 */

import type { ScrapedOdds } from './espn';

const DK_BASE = 'https://sportsbook-nash.draftkings.com/api/sportscontent/dkusva/v1/leagues';

// DraftKings league IDs
const LEAGUE_MAP: Record<string, number> = {
  basketball_nba: 42648,
  baseball_mlb: 84240,
};

interface DkEventGroup {
  events: DkEvent[];
}

interface DkEvent {
  eventId: number;
  name: string;
  startDate: string;
  eventStatus: { state: string };
  displayGroups: DkDisplayGroup[];
}

interface DkDisplayGroup {
  description: string;
  markets: DkMarket[];
}

interface DkMarket {
  description: string;
  outcomes: DkOutcome[];
}

interface DkOutcome {
  description: string;
  oddsAmerican: string;
  participant?: string;
  line?: number;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

/**
 * Fetch DraftKings odds for a sport.
 * Returns odds keyed by team matchup for correlation with ESPN data.
 */
export async function fetchDraftKingsOdds(sportKey: string): Promise<ScrapedOdds[]> {
  const leagueId = LEAGUE_MAP[sportKey];
  if (!leagueId) return [];

  const url = `${DK_BASE}/${leagueId}/events`;
  const data = await fetchJson<DkEventGroup>(url);
  if (!data?.events) return [];

  const odds: ScrapedOdds[] = [];

  for (const event of data.events) {
    if (event.eventStatus.state === 'ENDED') continue;

    // Use event name as correlation key (e.g., "BOS Celtics @ MIA Heat")
    const eventId = `dk_${event.eventId}`;

    for (const group of event.displayGroups ?? []) {
      for (const market of group.markets ?? []) {
        const marketKey = mapDkMarket(market.description);
        if (!marketKey) continue;

        const outcomes = market.outcomes
          .filter((o) => o.oddsAmerican && o.oddsAmerican !== 'EVEN')
          .map((o) => ({
            name: o.description || o.participant || 'Unknown',
            price: o.oddsAmerican === 'EVEN' ? 100 : parseInt(o.oddsAmerican),
            point: o.line,
          }))
          .filter((o) => !isNaN(o.price));

        if (outcomes.length >= 2) {
          odds.push({
            event_id: eventId,
            bookmaker_key: 'draftkings',
            bookmaker_name: 'DraftKings',
            market_key: marketKey,
            outcomes,
          });
        }
      }
    }
  }

  return odds;
}

function mapDkMarket(description: string): string | null {
  const lower = description.toLowerCase();
  if (lower.includes('moneyline') || lower.includes('money line')) return 'h2h';
  if (lower.includes('spread') || lower.includes('point spread')) return 'spreads';
  if (lower.includes('total') || lower.includes('over/under')) return 'totals';
  return null;
}
