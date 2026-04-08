/**
 * Kalshi/Robinhood prediction markets scraper.
 * Kalshi powers Robinhood's prediction markets.
 * Public API - no auth needed for market data.
 */

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

export interface KalshiContract {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle: string;
  yes_price: number | null;
  no_price: number | null;
  volume: number;
  open_interest: number;
  legs: string[];
  sport: 'nba' | 'mlb' | 'other';
  implied_prob: number | null;
}

interface KalshiMarketRaw {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle: string;
  yes_ask: number | null;
  no_ask: number | null;
  yes_bid: number | null;
  no_bid: number | null;
  last_price: number | null;
  volume: number;
  open_interest: number;
  status: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

/**
 * Fetch individual market details to get actual prices.
 */
async function fetchMarketPrice(ticker: string): Promise<{
  yes_price: number | null;
  no_price: number | null;
  volume: number;
  open_interest: number;
} | null> {
  const data = await fetchJson<{ market: KalshiMarketRaw }>(
    `${KALSHI_API}/markets/${ticker}`
  );
  if (!data?.market) return null;
  const m = data.market;
  return {
    yes_price: m.yes_ask ?? m.last_price,
    no_price: m.no_ask,
    volume: m.volume ?? 0,
    open_interest: m.open_interest ?? 0,
  };
}

/**
 * Classify if a market is NBA, MLB, or other.
 */
function classifySport(title: string, subtitle: string): 'nba' | 'mlb' | 'other' {
  const text = `${title} ${subtitle}`.toLowerCase();
  const nbaTeams = ['celtics', 'lakers', 'warriors', 'bucks', 'nuggets', 'suns', 'cavaliers', 'thunder', 'timberwolves', 'clippers', 'magic', 'pacers', 'knicks', 'heat', 'hawks', 'pistons', 'spurs', 'grizzlies', 'pelicans', 'mavericks', 'rockets', 'nets', 'raptors', 'bulls', 'hornets', 'jazz', 'blazers', 'kings', 'wizards', '76ers', 'nba', 'points scored', 'rebounds', 'assists'];
  const mlbTeams = ['yankees', 'dodgers', 'braves', 'astros', 'mets', 'phillies', 'padres', 'cubs', 'cardinals', 'guardians', 'orioles', 'rays', 'mariners', 'rangers', 'twins', 'tigers', 'reds', 'giants', 'diamondbacks', 'brewers', 'royals', 'pirates', 'rockies', 'angels', 'marlins', 'nationals', 'white sox', 'red sox', 'athletics', "a's", 'mlb', 'runs scored', 'strikeouts', 'hits'];

  if (nbaTeams.some((t) => text.includes(t))) return 'nba';
  if (mlbTeams.some((t) => text.includes(t))) return 'mlb';
  return 'other';
}

/**
 * Parse combo/parlay legs from title.
 */
function parseLegs(title: string): string[] {
  // Kalshi combos have format: "yes Team1,yes Team2,no Over 220.5..."
  return title
    .split(',')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 6);
}

/**
 * Fetch all sports-related Kalshi markets (NBA + MLB).
 * These are the same contracts available on Robinhood.
 */
export async function fetchKalshiSportsMarkets(): Promise<KalshiContract[]> {
  const data = await fetchJson<{ markets: KalshiMarketRaw[] }>(
    `${KALSHI_API}/markets?limit=200&status=open`
  );
  if (!data?.markets) return [];

  const sportsMarkets: KalshiContract[] = [];

  for (const m of data.markets) {
    const fullText = `${m.title} ${m.subtitle}`;
    const sport = classifySport(m.title, m.subtitle);
    if (sport === 'other') continue;

    // Fetch actual price for this market
    const price = await fetchMarketPrice(m.ticker);

    sportsMarkets.push({
      ticker: m.ticker,
      event_ticker: m.event_ticker,
      title: m.title,
      subtitle: m.subtitle,
      yes_price: price?.yes_price ?? null,
      no_price: price?.no_price ?? null,
      volume: price?.volume ?? 0,
      open_interest: price?.open_interest ?? 0,
      legs: parseLegs(fullText),
      sport,
      implied_prob: price?.yes_price ? price.yes_price / 100 : null,
    });

    // Limit to 20 to avoid too many API calls
    if (sportsMarkets.length >= 20) break;
  }

  return sportsMarkets;
}
