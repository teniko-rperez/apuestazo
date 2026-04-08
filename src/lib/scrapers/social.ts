/**
 * Social media picks aggregator.
 * Uses public RSS feeds and official public APIs.
 */

import type { ExpertPick } from './experts';

// Top betting Twitter/X accounts with proven records
const TWITTER_ACCOUNTS = [
  { handle: 'TheSharpPlays', name: 'The Sharp Plays', sport: 'nba' },
  { handle: 'PropBetGuy', name: 'Prop Bet Guy', sport: 'nba' },
  { handle: 'BallySports', name: 'Bally Sports', sport: 'mlb' },
  { handle: 'ActionNetworkHQ', name: 'Action Network', sport: 'nba' },
  { handle: 'br_betting', name: 'B/R Betting', sport: 'nba' },
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
  // Try multiple public Nitter/RSS instances
  const rssUrls = [
    `https://rsshub.app/twitter/user/${handle}`,
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

    // Look for betting-related keywords
    const bettingKeywords = /pick|bet|lock|play|under|over|spread|parlay|moneyline|ml|pts|ats|\+\d+\.?\d*|-\d+\.?\d*/i;
    if (!bettingKeywords.test(title)) continue;

    picks.push({
      expert_name: `@${handle} (${name})`,
      source: 'Twitter/X',
      source_url: `https://x.com/${handle}`,
      sport,
      pick_type: 'spread',
      pick_description: title.slice(0, 200),
      confidence: 'media',
      record: 'Ver perfil',
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
 * Aggregate all social media and public picks for a sport.
 */
export async function fetchSocialPicks(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const promises: Promise<ExpertPick[]>[] = [];

  // Twitter picks
  for (const account of TWITTER_ACCOUNTS.filter((a) => a.sport === sport || a.sport === 'both')) {
    promises.push(fetchTwitterPicks(account.handle, account.name, sport));
  }

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
