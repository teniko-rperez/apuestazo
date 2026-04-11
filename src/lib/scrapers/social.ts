/**
 * Social media picks aggregator.
 * Uses public RSS feeds and official public APIs.
 */

import type { ExpertPick } from './experts';

// ─── Top NBA Insiders ───
// Breaking news on trades, injuries, lineups — critical for live edge
const NBA_INSIDERS = [
  { handle: 'ShamsCharania', name: 'Shams Charania', sport: 'nba' },
  { handle: 'ChrisBHaynes', name: 'Chris Haynes', sport: 'nba' },
  { handle: 'TheSteinLine', name: 'Marc Stein', sport: 'nba' },
  { handle: 'KeithSmithNBA', name: 'Keith Smith', sport: 'nba' },
  { handle: 'WindhorstESPN', name: 'Brian Windhorst', sport: 'nba' },
  { handle: 'TimBontemps', name: 'Tim Bontemps', sport: 'nba' },
  { handle: 'sam_amick', name: 'Sam Amick', sport: 'nba' },
];

// ─── Top MLB Insiders ───
const MLB_INSIDERS = [
  { handle: 'JeffPassan', name: 'Jeff Passan', sport: 'mlb' },
  { handle: 'Ken_Rosenthal', name: 'Ken Rosenthal', sport: 'mlb' },
  { handle: 'Feinsand', name: 'Mark Feinsand', sport: 'mlb' },
  { handle: 'jonaborta', name: 'Jon Morosi', sport: 'mlb' },
  { handle: 'BNightengale', name: 'Bob Nightengale', sport: 'mlb' },
  { handle: 'JonHeyman', name: 'Jon Heyman', sport: 'mlb' },
];

// ─── Betting analysts with track records ───
const BETTING_ANALYSTS = [
  { handle: 'TheSharpPlays', name: 'The Sharp Plays', sport: 'both' },
  { handle: 'PropBetGuy', name: 'Prop Bet Guy', sport: 'nba' },
  { handle: 'BallySports', name: 'Bally Sports', sport: 'mlb' },
  { handle: 'ActionNetworkHQ', name: 'Action Network', sport: 'both' },
  { handle: 'br_betting', name: 'B/R Betting', sport: 'nba' },
  { handle: 'ESPNBet', name: 'ESPN BET', sport: 'both' },
  { handle: 'PFF_Bet', name: 'PFF Betting', sport: 'both' },
];

// Combined list — filtered per sport at fetch time
const TWITTER_ACCOUNTS = [
  ...NBA_INSIDERS,
  ...MLB_INSIDERS,
  ...BETTING_ANALYSTS,
];

/**
 * Fetch tweets from public RSS bridge services.
 * These services convert public Twitter feeds to RSS.
 */
async function fetchTwitterPicks(
  handle: string,
  name: string,
  sport: string
): Promise<ExpertPick[]> {
  // Try multiple public RSS bridge instances for Twitter/X
  const rssUrls = [
    `https://rsshub.app/twitter/user/${handle}`,
    `https://nitter.privacydev.net/${handle}/rss`,
    `https://nitter.poast.org/${handle}/rss`,
    `https://rss.app/feeds/v1.1/twitter/${handle}.json`,
  ];

  for (const url of rssUrls) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;

      const text = await res.text();
      return parseRssFeed(text, name, handle, sport);
    } catch {
      continue;
    }
  }

  return [];
}

function parseRssFeed(
  xml: string,
  name: string,
  handle: string,
  sport: string
): ExpertPick[] {
  const picks: ExpertPick[] = [];
  const now = new Date().toISOString();

  // Simple XML parsing for RSS items
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  for (const item of items.slice(0, 5)) {
    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/i);
    const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? '').trim();
    if (!title) continue;

    // Look for betting OR insider-relevant keywords (injuries, trades, lineups)
    const relevantKeywords = /pick|bet|lock|play|under|over|spread|parlay|moneyline|ml|pts|ats|\+\d+\.?\d*|-\d+\.?\d*|injury|injured|out\b|doubtful|questionable|ruled out|day-to-day|DTD|IL\b|lineup|starting|scratch|trade|waive|sign|roster|return|miss|absence|sit out|rest/i;
    if (!relevantKeywords.test(title)) continue;

    // Determine confidence based on source type
    const isInsider = NBA_INSIDERS.some(i => i.handle === handle) || MLB_INSIDERS.some(i => i.handle === handle);
    const isInjuryNews = /injury|injured|out\b|doubtful|questionable|ruled out|day-to-day|DTD|IL\b|miss|absence|sit out|rest|scratch/i.test(title);
    const conf: 'alta' | 'media' | 'baja' = isInsider && isInjuryNews ? 'alta' : isInsider ? 'media' : 'media';

    picks.push({
      expert_name: `@${handle} (${name})`,
      source: isInsider ? 'Insider/X' : 'Twitter/X',
      source_url: `https://x.com/${handle}`,
      sport,
      pick_type: isInjuryNews ? 'injury_intel' : 'spread',
      pick_description: title.slice(0, 200),
      confidence: conf,
      record: isInsider ? 'Insider verificado' : 'Ver perfil',
      profit_units: null,
      scraped_at: now,
    });
  }

  return picks;
}

/**
 * Fetch Reddit sports betting picks from multiple subreddits.
 * Uses Reddit's official public .json API.
 */
async function fetchRedditSportsPicks(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const subreddits = sport === 'nba'
    ? ['sportsbook', 'sportsbetting', 'NBAbetting']
    : ['sportsbook', 'sportsbetting', 'MLBbetting'];

  const allPicks: ExpertPick[] = [];
  const now = new Date().toISOString();

  for (const sub of subreddits) {
    try {
      const url = `https://old.reddit.com/r/${sub}/search.json?q=${sport.toUpperCase()}+daily&sort=new&restrict_sr=on&limit=3&t=day`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data = await res.json() as {
        data: {
          children: Array<{
            data: {
              title: string;
              selftext: string;
              url: string;
              score: number;
              num_comments: number;
              subreddit: string;
            };
          }>;
        };
      };

      for (const post of data.data.children ?? []) {
        const { title, selftext, url: postUrl, score, num_comments, subreddit } = post.data;

        if (score < 3) continue;

        // Extract any betting lines from the post
        const lines: string[] = [];
        const linePattern = /([A-Z][a-zA-Z\s]+)\s*([+-]\d+\.?\d*)/g;
        let match;
        const textToScan = `${title} ${selftext.slice(0, 500)}`;
        while ((match = linePattern.exec(textToScan)) !== null) {
          lines.push(`${match[1].trim()} ${match[2]}`);
        }

        const description = lines.length > 0
          ? lines.slice(0, 3).join(' | ')
          : title.slice(0, 150);

        allPicks.push({
          expert_name: `r/${subreddit}`,
          source: `Reddit r/${subreddit}`,
          source_url: postUrl,
          sport,
          pick_type: 'spread',
          pick_description: description,
          confidence: score > 30 ? 'alta' : score > 10 ? 'media' : 'baja',
          record: `${score} upvotes, ${num_comments} comments`,
          profit_units: null,
          scraped_at: now,
        });
      }
    } catch {
      continue;
    }
  }

  return allPicks;
}

/**
 * Fetch from public betting news/analysis sites RSS feeds.
 */
async function fetchBettingNewsPicks(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const feeds = [
    {
      url: 'https://www.actionnetwork.com/rss',
      name: 'Action Network',
      sourceUrl: 'https://actionnetwork.com',
    },
    {
      url: `https://www.covers.com/picks/${sport === 'nba' ? 'basketball' : 'baseball'}/rss`,
      name: 'Covers.com',
      sourceUrl: `https://covers.com/picks/${sport === 'nba' ? 'basketball' : 'baseball'}`,
    },
  ];

  const picks: ExpertPick[] = [];
  const now = new Date().toISOString();

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

      for (const item of items.slice(0, 5)) {
        const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/i);
        const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? '').trim();
        if (!title) continue;

        const sportKeywords = sport === 'nba'
          ? /nba|basketball|celtics|lakers|warriors|bucks|nuggets|suns/i
          : /mlb|baseball|yankees|dodgers|braves|astros|mets|phillies/i;

        if (!sportKeywords.test(title)) continue;

        picks.push({
          expert_name: feed.name,
          source: feed.name,
          source_url: feed.sourceUrl,
          sport,
          pick_type: 'spread',
          pick_description: title.slice(0, 200),
          confidence: 'media',
          record: 'N/A',
          profit_units: null,
          scraped_at: now,
        });
      }
    } catch {
      continue;
    }
  }

  return picks;
}

/**
 * Fetch breaking news from ESPN's public news API.
 * Shams Charania works for ESPN — his reports appear here.
 * Captures injury news, trades, lineup changes FASTER than ESPN injury API updates.
 */
async function fetchEspnInsiderNews(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const espnSport = sport === 'nba' ? 'basketball/nba' : 'baseball/mlb';
  const picks: ExpertPick[] = [];
  const now = new Date().toISOString();

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/news`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      articles?: Array<{
        headline?: string;
        description?: string;
        published?: string;
        byline?: string;
        links?: { web?: { href?: string } };
      }>;
    };

    const injuryRegex = /injury|injured|out\b|doubtful|questionable|ruled out|day-to-day|DTD|IL\b|surgery|miss|absence|sit out|rest|scratch|sidelined|torn|sprain|strain|fracture|concussion|appendicitis/i;
    const insiderNames = /charania|shams|wojnarowski|woj|passan|rosenthal|haynes|stein|windhorst|bontemps|amick|feinsand|morosi|nightengale|heyman/i;

    for (const article of (data.articles ?? []).slice(0, 15)) {
      const headline = article.headline ?? '';
      const desc = article.description ?? '';
      const byline = article.byline ?? '';
      const fullText = `${headline} ${desc}`;
      if (!headline) continue;

      // Only grab injury/status news
      const isInjuryNews = injuryRegex.test(fullText);
      const isFromInsider = insiderNames.test(byline) || insiderNames.test(headline);
      if (!isInjuryNews && !isFromInsider) continue;

      // Determine if recently published (within 24h)
      const pubDate = article.published ? new Date(article.published).getTime() : 0;
      if (pubDate > 0 && Date.now() - pubDate > 24 * 60 * 60 * 1000) continue;

      const source = isFromInsider ? 'Insider/X' : 'ESPN News';
      const expertName = isFromInsider
        ? `ESPN Insider (${byline.split(',')[0].trim()})`
        : 'ESPN News';

      picks.push({
        expert_name: expertName,
        source,
        source_url: article.links?.web?.href ?? `https://www.espn.com/${sport}`,
        sport,
        pick_type: isInjuryNews ? 'injury_intel' : 'news',
        pick_description: headline.slice(0, 200),
        confidence: isFromInsider && isInjuryNews ? 'alta' : isInjuryNews ? 'alta' : 'media',
        record: isFromInsider ? 'Insider verificado' : 'ESPN',
        profit_units: null,
        scraped_at: now,
      });
    }
  } catch { /* ok */ }

  return picks;
}

/**
 * Fetch Rotoworld/NBC Sports injury news — another fast source for lineup changes.
 */
async function fetchRotoworldNews(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const picks: ExpertPick[] = [];
  const now = new Date().toISOString();
  const rotoSport = sport === 'nba' ? 'basketball' : 'baseball';

  try {
    const res = await fetch(
      `https://www.rotowire.com/rss/news.php?sport=${sport.toUpperCase()}`,
      {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

    const injuryRegex = /injury|out\b|doubtful|questionable|ruled out|IL\b|surgery|miss|sidelined|scratch|rest|status|GTD|game-time/i;

    for (const item of items.slice(0, 10)) {
      const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/i);
      const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? '').trim();
      if (!title || !injuryRegex.test(title)) continue;

      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
      const link = linkMatch?.[1]?.trim() ?? `https://www.rotowire.com/${rotoSport}/`;

      picks.push({
        expert_name: 'RotoWire',
        source: 'RotoWire',
        source_url: link,
        sport,
        pick_type: 'injury_intel',
        pick_description: title.slice(0, 200),
        confidence: 'alta',
        record: 'RotoWire News',
        profit_units: null,
        scraped_at: now,
      });
    }
  } catch { /* ok */ }

  return picks;
}

/**
 * Aggregate all social media and public picks for a sport.
 */
export async function fetchSocialPicks(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const promises: Promise<ExpertPick[]>[] = [];

  // Twitter picks (insiders + analysts)
  for (const account of TWITTER_ACCOUNTS.filter((a) => a.sport === sport || a.sport === 'both')) {
    promises.push(fetchTwitterPicks(account.handle, account.name, sport));
  }

  // ESPN insider news (Shams Charania + other ESPN insiders)
  promises.push(fetchEspnInsiderNews(sport));

  // RotoWire injury/lineup news
  promises.push(fetchRotoworldNews(sport));

  // Reddit picks from multiple subreddits
  promises.push(fetchRedditSportsPicks(sport));

  // Betting news RSS
  promises.push(fetchBettingNewsPicks(sport));

  const results = await Promise.allSettled(promises);
  const picks: ExpertPick[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      picks.push(...result.value);
    }
  }

  return picks;
}
