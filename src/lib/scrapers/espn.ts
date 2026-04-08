/**
 * ESPN Public API scraper - No auth required.
 * Uses core API for odds + scoreboard for events.
 */

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports';

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

const SPORT_MAP: Record<string, { scoreboard: string; core: string }> = {
  basketball_nba: { scoreboard: 'basketball/nba', core: 'basketball/leagues/nba' },
  baseball_mlb: { scoreboard: 'baseball/mlb', core: 'baseball/leagues/mlb' },
};

// ESPN provider ID -> our bookmaker key
const PROVIDER_MAP: Record<string, string> = {
  '100': 'draftkings',
  '58': 'betmgm',
  '38': 'williamhill_us', // Caesars
  '37': 'fanduel',
  '68': 'espnbet',
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

interface EspnScoreboard {
  events: Array<{
    id: string;
    date: string;
    name: string;
    competitions: Array<{
      id: string;
      date: string;
      competitors: Array<{
        homeAway: 'home' | 'away';
        team: { displayName: string };
        score?: string;
        winner?: boolean;
      }>;
      status: { type: { name: string } };
    }>;
  }>;
}

interface EspnOddsResponse {
  items: Array<{ $ref: string }>;
}

interface EspnOddsDetail {
  provider: { id: string; name: string };
  details: string;
  overUnder: number | null;
  spread: number | null;
  overOdds: number | null;
  underOdds: number | null;
  awayTeamOdds: { moneyLine: number; spreadOdds?: number };
  homeTeamOdds: { moneyLine: number; spreadOdds?: number };
}

/**
 * Fetch events + odds for a sport from ESPN.
 * Fetches today + tomorrow to cover all US timezones.
 */
export async function fetchEspnScoreboard(sportKey: string): Promise<{
  events: ScrapedEvent[];
  odds: ScrapedOdds[];
}> {
  const paths = SPORT_MAP[sportKey];
  if (!paths) return { events: [], odds: [] };

  const events: ScrapedEvent[] = [];
  const allOdds: ScrapedOdds[] = [];
  const seenEventIds = new Set<string>();

  // Fetch today and tomorrow (covers timezone differences)
  const dates: string[] = [];
  for (let i = 0; i <= 1; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  for (const date of dates) {
    const scoreboard = await fetchJson<EspnScoreboard>(
      `${ESPN_SCOREBOARD}/${paths.scoreboard}/scoreboard?dates=${date}`
    );
    if (!scoreboard) continue;

    for (const event of scoreboard.events) {
      const comp = event.competitions[0];
      if (!comp) continue;

      const eventId = `espn_${event.id}`;
      if (seenEventIds.has(eventId)) continue;
      seenEventIds.add(eventId);

      const home = comp.competitors.find((c) => c.homeAway === 'home');
      const away = comp.competitors.find((c) => c.homeAway === 'away');
      if (!home || !away) continue;

      const statusName = comp.status.type.name;
      const completed = statusName === 'STATUS_FINAL';

      events.push({
        id: eventId,
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

      // 2. Fetch odds per competition via core API
      const oddsListUrl = `${ESPN_CORE}/${paths.core}/events/${event.id}/competitions/${comp.id}/odds`;
      const oddsList = await fetchJson<EspnOddsResponse>(oddsListUrl);

      if (oddsList?.items) {
        for (const item of oddsList.items) {
          const ref = item.$ref;
          if (!ref) continue;

          // Skip live odds providers (id=200+)
          const providerIdMatch = ref.match(/odds\/(\d+)/);
          const providerId = providerIdMatch?.[1];
          if (!providerId || parseInt(providerId) >= 200) continue;

          const bookKey = PROVIDER_MAP[providerId];
          if (!bookKey) continue;

          const detail = await fetchJson<EspnOddsDetail>(ref);
          if (!detail) continue;

          const homeName = home.team.displayName;
          const awayName = away.team.displayName;

          // Moneyline
          if (detail.homeTeamOdds?.moneyLine && detail.awayTeamOdds?.moneyLine) {
            allOdds.push({
              event_id: eventId,
              bookmaker_key: bookKey,
              bookmaker_name: detail.provider.name,
              market_key: 'h2h',
              outcomes: [
                { name: homeName, price: detail.homeTeamOdds.moneyLine },
                { name: awayName, price: detail.awayTeamOdds.moneyLine },
              ],
            });
          }

          // Spread
          if (detail.spread != null) {
            const homeSpreadOdds = detail.homeTeamOdds?.spreadOdds ?? -110;
            const awaySpreadOdds = detail.awayTeamOdds?.spreadOdds ?? -110;
            allOdds.push({
              event_id: eventId,
              bookmaker_key: bookKey,
              bookmaker_name: detail.provider.name,
              market_key: 'spreads',
              outcomes: [
                { name: homeName, price: homeSpreadOdds, point: -detail.spread },
                { name: awayName, price: awaySpreadOdds, point: detail.spread },
              ],
            });
          }

          // Totals
          if (detail.overUnder != null) {
            allOdds.push({
              event_id: eventId,
              bookmaker_key: bookKey,
              bookmaker_name: detail.provider.name,
              market_key: 'totals',
              outcomes: [
                { name: 'Over', price: detail.overOdds ?? -110, point: detail.overUnder },
                { name: 'Under', price: detail.underOdds ?? -110, point: detail.overUnder },
              ],
            });
          }
        }
      }
    }
  } // end dates loop

  return { events, odds: allOdds };
}
