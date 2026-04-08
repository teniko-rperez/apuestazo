import { ODDS_API_BASE, BOOKMAKER_KEYS } from '../constants';
import type {
  OddsApiEvent,
  OddsApiEventBasic,
  OddsApiScore,
} from './types';

const API_KEY = () => process.env.ODDS_API_KEY!;

async function fetchApi<T>(path: string, params: Record<string, string> = {}): Promise<{ data: T; remaining: string | null }> {
  const url = new URL(`${ODDS_API_BASE}${path}`);
  url.searchParams.set('apiKey', API_KEY());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Odds API error ${res.status}: ${body}`);
  }

  const remaining = res.headers.get('x-requests-remaining');
  const data = (await res.json()) as T;
  return { data, remaining };
}

/** Fetch events for a sport (FREE - 0 credits) */
export async function fetchEvents(sportKey: string): Promise<OddsApiEventBasic[]> {
  const { data } = await fetchApi<OddsApiEventBasic[]>(`/sports/${sportKey}/events`);
  return data;
}

/** Fetch scores for a sport (FREE for completed games) */
export async function fetchScores(sportKey: string): Promise<OddsApiScore[]> {
  const { data } = await fetchApi<OddsApiScore[]>(`/sports/${sportKey}/scores`, {
    daysFrom: '1',
  });
  return data;
}

/**
 * Fetch odds for a sport (COSTS credits: 1 per market per region).
 * markets: ['h2h', 'spreads', 'totals'] = 3 credits
 */
export async function fetchOdds(
  sportKey: string,
  markets: string[] = ['h2h', 'spreads', 'totals']
): Promise<{ events: OddsApiEvent[]; creditsUsed: number }> {
  const { data } = await fetchApi<OddsApiEvent[]>(`/sports/${sportKey}/odds`, {
    regions: 'us',
    markets: markets.join(','),
    oddsFormat: 'american',
    bookmakers: BOOKMAKER_KEYS.join(','),
  });

  return { events: data, creditsUsed: markets.length };
}

/**
 * Fetch player prop odds for a specific event (COSTS credits).
 */
export async function fetchEventProps(
  sportKey: string,
  eventId: string,
  markets: string[]
): Promise<{ event: OddsApiEvent | null; creditsUsed: number }> {
  try {
    const { data } = await fetchApi<OddsApiEvent>(
      `/sports/${sportKey}/events/${eventId}/odds`,
      {
        regions: 'us',
        markets: markets.join(','),
        oddsFormat: 'american',
        bookmakers: BOOKMAKER_KEYS.join(','),
      }
    );
    return { event: data, creditsUsed: markets.length };
  } catch {
    return { event: null, creditsUsed: markets.length };
  }
}
