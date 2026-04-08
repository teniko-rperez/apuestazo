/**
 * Expert picks scraper - monitors betting experts and tipsters.
 * Scrapes from Covers.com leaderboard and public pick sites.
 */

export interface ExpertPick {
  expert_name: string;
  source: string;
  source_url: string;
  sport: string;
  pick_type: string; // 'moneyline' | 'spread' | 'total' | 'prop'
  pick_description: string;
  confidence: 'alta' | 'media' | 'baja';
  record: string; // e.g., "145-120 (54.7%)"
  profit_units: number | null;
  scraped_at: string;
}

/**
 * Fetch expert leaderboard from Covers.com
 */
export async function fetchCoversExperts(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const sportPath = sport === 'nba' ? 'basketball' : 'baseball';
  const url = `https://www.covers.com/picks/${sportPath}`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
    });

    if (!res.ok) return [];

    const html = await res.text();
    return parseCoversHtml(html, sport);
  } catch {
    return [];
  }
}

function parseCoversHtml(html: string, sport: string): ExpertPick[] {
  const picks: ExpertPick[] = [];
  const now = new Date().toISOString();

  // Parse expert pick cards from Covers HTML
  // Look for patterns like expert name, record, and pick info
  const expertPattern =
    /<div[^>]*class="[^"]*expert[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  const matches = html.match(expertPattern) ?? [];

  for (const match of matches) {
    // Extract expert name
    const nameMatch = match.match(
      /class="[^"]*name[^"]*"[^>]*>([^<]+)</i
    );
    // Extract record
    const recordMatch = match.match(
      /(\d+)-(\d+)\s*\(?([\d.]+%?)\)?/
    );
    // Extract pick description
    const pickMatch = match.match(
      /class="[^"]*pick[^"]*"[^>]*>([^<]+)</i
    );

    if (nameMatch) {
      const wins = recordMatch ? parseInt(recordMatch[1]) : 0;
      const losses = recordMatch ? parseInt(recordMatch[2]) : 0;
      const winPct = wins + losses > 0 ? wins / (wins + losses) : 0;

      picks.push({
        expert_name: nameMatch[1].trim(),
        source: 'Covers.com',
        source_url: `https://www.covers.com/picks/${sport === 'nba' ? 'basketball' : 'baseball'}`,
        sport,
        pick_type: 'spread',
        pick_description: pickMatch ? pickMatch[1].trim() : 'Consultar sitio',
        confidence: winPct > 0.57 ? 'alta' : winPct > 0.53 ? 'media' : 'baja',
        record: recordMatch
          ? `${recordMatch[1]}-${recordMatch[2]} (${recordMatch[3]})`
          : 'N/A',
        profit_units: null,
        scraped_at: now,
      });
    }
  }

  return picks;
}

/**
 * Fetch Reddit r/sportsbook consensus picks via old.reddit.com JSON API.
 * Reddit exposes .json on any page without auth.
 */
export async function fetchRedditPicks(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const query = sport === 'nba' ? 'NBA daily' : 'MLB daily';
  const url = `https://old.reddit.com/r/sportsbook/search.json?q=${encodeURIComponent(query)}&sort=new&restrict_sr=on&limit=5`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)',
      },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      data: {
        children: Array<{
          data: {
            title: string;
            selftext: string;
            url: string;
            score: number;
            created_utc: number;
          };
        }>;
      };
    };

    const picks: ExpertPick[] = [];
    const now = new Date().toISOString();

    for (const post of data.data.children ?? []) {
      const { title, selftext, url: postUrl, score } = post.data;

      // Extract picks that mention specific teams/lines from highly upvoted comments
      if (score > 5 && (title.toLowerCase().includes(sport) || title.toLowerCase().includes('daily'))) {
        // Look for betting lines in the post text (e.g., "Lakers -3.5", "Over 220.5")
        const linePattern =
          /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*([+-]?\d+\.?\d*)/g;
        let lineMatch;

        while ((lineMatch = linePattern.exec(selftext)) !== null) {
          picks.push({
            expert_name: `r/sportsbook (${score} upvotes)`,
            source: 'Reddit r/sportsbook',
            source_url: postUrl,
            sport,
            pick_type: 'spread',
            pick_description: `${lineMatch[1]} ${lineMatch[2]}`,
            confidence: score > 50 ? 'alta' : score > 20 ? 'media' : 'baja',
            record: `${score} upvotes`,
            profit_units: null,
            scraped_at: now,
          });
        }
      }
    }

    return picks.slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Aggregate all expert picks for a sport.
 */
export async function fetchAllExpertPicks(
  sport: 'nba' | 'mlb'
): Promise<ExpertPick[]> {
  // Dynamic import to avoid circular deps
  const { fetchSocialPicks } = await import('./social');

  const [covers, reddit, social] = await Promise.all([
    fetchCoversExperts(sport).catch(() => []),
    fetchRedditPicks(sport).catch(() => []),
    fetchSocialPicks(sport).catch(() => []),
  ]);

  return [...covers, ...reddit, ...social];
}
