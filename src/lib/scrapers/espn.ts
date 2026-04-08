/**
 * ESPN Public API scraper - No auth required.
 * Gets odds from multiple bookmakers (DraftKings, FanDuel, Caesars, BetMGM, ESPN BET).
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

interface EspnEvent {
  id: string;
  date: string;
  name: string;
  competitions: EspnCompetition[];
}

interface EspnCompetition {
  id: string;
  date: string;
  competitors: EspnCompetitor[];
  odds?: EspnOdds[];
}

interface EspnCompetitor {
  homeAway: 'home' | 'away';
  team: { displayName: string; abbreviation: string };
  score?: string;
  winner?: boolean;
}

interface EspnOdds {
  provider: { id: string; name: string; priority: number };
  details: string; // e.g. "BOS -5.5"
  overUnder: number;
  spread: number;
  overOdds?: number;
  underOdds?: number;
  awayTeamOdds: { moneyLine: number; spreadOdds?: number };
  homeTeamOdds: { moneyLine: number; spreadOdds?: number };
}

interface EspnScoreboard {
  events: EspnEvent[];
}

export interface ScrapedEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  completed: boolean;
  scores: { home: number; away: number } | null;
}

export interface ScrapedOdds {
  event_id: string;
  bookmaker_key: string;
  bookmaker_name: string;
  market_key: string;
  outcomes: { name: string; price: number; point?: number }[];
}

// ESPN provider IDs to our bookmaker keys
const PROVIDER_MAP: Record<string, string> = {
  '41': 'draftkings',
  '37': 'fanduel',
  '38': 'williamhill_us', // Caesars
  '58': 'betmgm',
  '68': 'espnbet',
};

const SPORT_MAP: Record<string, string> = {
  basketball_nba: 'basketball/nba',
  baseball_mlb: 'baseball/mlb',
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
  });
  if (!res.ok) throw new Error(`ESPN API error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/**
 * Fetch scoreboard for a sport - returns events with odds.
 */
export async function fetchEspnScoreboard(sportKey: string): Promise<{
  events: ScrapedEvent[];
  odds: ScrapedOdds[];
}> {
  const espnSport = SPORT_MAP[sportKey];
  if (!espnSport) throw new Error(`Unknown sport: ${sportKey}`);

  const url = `${ESPN_BASE}/${espnSport}/scoreboard`;
  const data = await fetchJson<EspnScoreboard>(url);

  const events: ScrapedEvent[] = [];
  const odds: ScrapedOdds[] = [];

  for (const event of data.events) {
    const comp = event.competitions[0];
    if (!comp) continue;

    const home = comp.competitors.find((c) => c.homeAway === 'home');
    const away = comp.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    const completed = home.winner != null || away.winner != null;

    events.push({
      id: `espn_${event.id}`,
      sport_key: sportKey,
      commence_time: comp.date || event.date,
      home_team: home.team.displayName,
      away_team: away.team.displayName,
      completed,
      scores:
        home.score != null && away.score != null
          ? { home: parseInt(home.score), away: parseInt(away.score) }
          : null,
    });

    // Extract odds from each provider
    if (comp.odds) {
      for (const odd of comp.odds) {
        const bookKey = PROVIDER_MAP[odd.provider.id];
        if (!bookKey) continue;

        const eventId = `espn_${event.id}`;

        // Moneyline (h2h)
        if (odd.homeTeamOdds?.moneyLine && odd.awayTeamOdds?.moneyLine) {
          odds.push({
            event_id: eventId,
            bookmaker_key: bookKey,
            bookmaker_name: odd.provider.name,
            market_key: 'h2h',
            outcomes: [
              { name: home.team.displayName, price: odd.homeTeamOdds.moneyLine },
              { name: away.team.displayName, price: odd.awayTeamOdds.moneyLine },
            ],
          });
        }

        // Spread
        if (odd.spread != null) {
          const homeSpreadOdds = odd.homeTeamOdds?.spreadOdds ?? -110;
          const awaySpreadOdds = odd.awayTeamOdds?.spreadOdds ?? -110;
          odds.push({
            event_id: eventId,
            bookmaker_key: bookKey,
            bookmaker_name: odd.provider.name,
            market_key: 'spreads',
            outcomes: [
              { name: home.team.displayName, price: homeSpreadOdds, point: odd.spread },
              { name: away.team.displayName, price: awaySpreadOdds, point: -odd.spread },
            ],
          });
        }

        // Totals (over/under)
        if (odd.overUnder != null) {
          const overOdds = odd.overOdds ?? -110;
          const underOdds = odd.underOdds ?? -110;
          odds.push({
            event_id: eventId,
            bookmaker_key: bookKey,
            bookmaker_name: odd.provider.name,
            market_key: 'totals',
            outcomes: [
              { name: 'Over', price: overOdds, point: odd.overUnder },
              { name: 'Under', price: underOdds, point: odd.overUnder },
            ],
          });
        }
      }
    }
  }

  return { events, odds };
}

/**
 * Fetch upcoming schedule (next 7 days) - useful for future games.
 */
export async function fetchEspnSchedule(sportKey: string): Promise<ScrapedEvent[]> {
  const espnSport = SPORT_MAP[sportKey];
  if (!espnSport) throw new Error(`Unknown sport: ${sportKey}`);

  // Get dates for next 7 days
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  const allEvents: ScrapedEvent[] = [];

  for (const date of dates) {
    try {
      const url = `${ESPN_BASE}/${espnSport}/scoreboard?dates=${date}`;
      const data = await fetchJson<EspnScoreboard>(url);

      for (const event of data.events) {
        const comp = event.competitions[0];
        if (!comp) continue;

        const home = comp.competitors.find((c) => c.homeAway === 'home');
        const away = comp.competitors.find((c) => c.homeAway === 'away');
        if (!home || !away) continue;

        allEvents.push({
          id: `espn_${event.id}`,
          sport_key: sportKey,
          commence_time: comp.date || event.date,
          home_team: home.team.displayName,
          away_team: away.team.displayName,
          completed: false,
          scores: null,
        });
      }
    } catch {
      // Skip date on error
    }
  }

  return allEvents;
}
