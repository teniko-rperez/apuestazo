/**
 * Polymarket prediction market scraper.
 * 100% free, no auth. Uses their public CLOB API.
 */

const POLY_API = 'https://clob.polymarket.com';

export interface PolyContract {
  condition_id: string;
  question: string;
  outcome_yes: string;
  outcome_no: string;
  yes_price: number;
  no_price: number;
  volume: number;
  sport: 'nba' | 'mlb' | 'other';
}

interface PolyMarketRaw {
  condition_id: string;
  question: string;
  tokens: Array<{ token_id: string; outcome: string; price: number }>;
  volume_num_24hr: number;
  active: boolean;
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
  } catch { return null; }
}

function classifySport(question: string): 'nba' | 'mlb' | 'other' {
  const q = question.toLowerCase();
  const nba = ['nba', 'celtics', 'lakers', 'warriors', 'bucks', 'nuggets', 'suns', 'cavaliers', 'thunder', 'basketball', 'playoff', 'finals'];
  const mlb = ['mlb', 'yankees', 'dodgers', 'braves', 'astros', 'mets', 'phillies', 'baseball', 'world series'];
  if (nba.some((w) => q.includes(w))) return 'nba';
  if (mlb.some((w) => q.includes(w))) return 'mlb';
  return 'other';
}

/**
 * Fetch sports-related Polymarket contracts.
 */
export async function fetchPolymarketSports(): Promise<PolyContract[]> {
  // Polymarket uses a sampling endpoint
  const data = await fetchJson<PolyMarketRaw[]>(`${POLY_API}/markets?limit=100&active=true`);
  if (!data) return [];

  const contracts: PolyContract[] = [];

  for (const m of data) {
    const sport = classifySport(m.question);
    if (sport === 'other') continue;

    const yesToken = m.tokens?.find((t) => t.outcome === 'Yes');
    const noToken = m.tokens?.find((t) => t.outcome === 'No');

    contracts.push({
      condition_id: m.condition_id,
      question: m.question,
      outcome_yes: 'Yes',
      outcome_no: 'No',
      yes_price: yesToken?.price ?? 0,
      no_price: noToken?.price ?? 0,
      volume: m.volume_num_24hr ?? 0,
      sport,
    });
  }

  return contracts;
}
