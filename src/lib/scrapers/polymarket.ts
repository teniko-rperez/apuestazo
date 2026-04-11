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
  tokens: Array<{ token_id: string; outcome: string; price: number; winner?: boolean }>;
  active: boolean;
  closed: boolean;
  archived?: boolean;
  accepting_orders?: boolean;
  game_start_time?: string | null;
  end_date_iso?: string | null;
  volume_24hr?: number;
  volume_num_24hr?: number;
}

interface PolyListResponse {
  data: PolyMarketRaw[];
  next_cursor?: string;
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
 * The CLOB /markets endpoint returns { data: [...] } with ~500 markets per page;
 * we walk pages until we exhaust them or hit a safety cap.
 * Each market has 2 tokens (one per outcome); we emit one PolyContract per token
 * so the engine can match each side against a team name.
 */
export async function fetchPolymarketSports(): Promise<PolyContract[]> {
  const contracts: PolyContract[] = [];
  const nowIso = new Date().toISOString();
  const cutoffPast = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let cursor: string | undefined = '';
  let pages = 0;
  const maxPages = 6; // safety cap

  while (pages < maxPages) {
    const url: string = cursor
      ? `${POLY_API}/markets?next_cursor=${encodeURIComponent(cursor)}`
      : `${POLY_API}/markets`;
    const page: PolyListResponse | null = await fetchJson<PolyListResponse>(url);
    if (!page || !Array.isArray(page.data)) break;

    for (const m of page.data) {
      // Only current, tradeable sports markets
      if (m.closed || m.archived || !m.active) continue;
      if (m.accepting_orders === false) continue;

      // Filter by game start time: ignore games older than 24h ago and >30 days out
      if (m.game_start_time) {
        if (m.game_start_time < cutoffPast) continue;
      } else if (m.end_date_iso && m.end_date_iso < nowIso) {
        continue;
      }

      const sport = classifySport(m.question);
      if (sport === 'other') continue;

      const tokens = m.tokens ?? [];
      if (tokens.length === 0) continue;

      const volume = m.volume_num_24hr ?? m.volume_24hr ?? 0;

      // Emit one contract per token so the engine can match per outcome.
      for (const t of tokens) {
        if (!t || typeof t.price !== 'number') continue;
        const otherPrice = tokens.find((x) => x.token_id !== t.token_id)?.price ?? 1 - t.price;
        contracts.push({
          condition_id: m.condition_id,
          question: `${m.question} — ${t.outcome}`,
          outcome_yes: t.outcome,
          outcome_no: tokens.find((x) => x.token_id !== t.token_id)?.outcome ?? 'Other',
          yes_price: t.price,
          no_price: otherPrice,
          volume,
          sport,
        });
      }
    }

    cursor = page.next_cursor && page.next_cursor !== 'LTE=' ? page.next_cursor : undefined;
    if (!cursor) break;
    pages++;
  }

  return contracts;
}
