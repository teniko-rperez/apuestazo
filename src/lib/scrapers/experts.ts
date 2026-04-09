/**
 * Expert picks scraper.
 * Sources: Reddit (multiple subs), Covers.com, Social media.
 */

export interface ExpertPick {
  expert_name: string;
  source: string;
  source_url: string;
  sport: string;
  pick_type: string;
  pick_description: string;
  confidence: 'alta' | 'media' | 'baja';
  record: string;
  profit_units: number | null;
  scraped_at: string;
}

/**
 * Fetch Reddit picks from multiple sports betting subreddits.
 */
async function fetchRedditPicks(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const subs = ['sportsbook', 'sportsbetting'];
  if (sport === 'nba') subs.push('NBAbetting');
  if (sport === 'mlb') subs.push('MLBbetting');

  const allPicks: ExpertPick[] = [];
  const now = new Date().toISOString();

  for (const sub of subs) {
    try {
      // Get hot posts + search for sport-specific
      const url = `https://old.reddit.com/r/${sub}/hot.json?limit=25`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Apuestazo/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;

      const data = await res.json() as {
        data: { children: Array<{ data: { title: string; selftext: string; url: string; score: number; num_comments: number; subreddit: string } }> };
      };

      for (const post of data.data.children ?? []) {
        const { title, selftext, url: postUrl, score, num_comments, subreddit } = post.data;
        if (score < 3) continue;

        const fullText = `${title} ${selftext.slice(0, 500)}`.toLowerCase();
        const sportMatch = sport === 'nba'
          ? /nba|basketball|celtics|lakers|warriors|bucks|nuggets|suns|cavaliers|thunder|mavericks|rockets|clippers|heat|hawks|76ers|knicks|pacers|magic|grizzlies|pelicans|spurs|pistons|nets|raptors|bulls|hornets|jazz|blazers|kings|wizards/i
          : /mlb|baseball|yankees|dodgers|braves|astros|mets|phillies|padres|cubs|cardinals|guardians|orioles|rays|mariners|rangers|twins|tigers|reds|giants|diamondbacks|brewers|royals|pirates|rockies|angels|marlins|nationals|white sox|red sox/i;

        // Match in title OR selftext
        if (!sportMatch.test(fullText)) continue;

        // Always save the post title as a pick (it's the main signal)
        allPicks.push({
          expert_name: `r/${subreddit}`,
          source: `Reddit r/${subreddit}`,
          source_url: postUrl.startsWith('http') ? postUrl : `https://old.reddit.com${postUrl}`,
          sport,
          pick_type: title.toLowerCase().includes('prop') ? 'prop' : 'spread',
          pick_description: title.slice(0, 200),
          confidence: score > 50 ? 'alta' : score > 15 ? 'media' : 'baja',
          record: `${score} upvotes, ${num_comments} comments`,
          profit_units: null,
          scraped_at: now,
        });

        // Also extract any team/line mentions from selftext
        const text = selftext.slice(0, 1000);
        const teams = text.match(/(?:celtics|lakers|warriors|bucks|nuggets|suns|cavaliers|thunder|mavericks|rockets|nets|heat|hawks|76ers|knicks|clippers|yankees|dodgers|braves|astros|mets|phillies|padres|cubs|cardinals|guardians|orioles|rays|mariners|rangers|twins|tigers|reds|giants|diamondbacks|brewers|royals|pirates|rockies|angels|marlins|nationals|white sox|red sox)\s*[+-]?\d*\.?\d*/gi) ?? [];

        for (const match of teams.slice(0, 3)) {
          allPicks.push({
            expert_name: `r/${subreddit} user`,
            source: `Reddit r/${subreddit}`,
            source_url: postUrl.startsWith('http') ? postUrl : `https://old.reddit.com${postUrl}`,
            sport,
            pick_type: 'spread',
            pick_description: match.trim(),
            confidence: score > 30 ? 'media' : 'baja',
            record: `from post (${score} upvotes)`,
            profit_units: null,
            scraped_at: now,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return allPicks.slice(0, 20);
}

/**
 * Fetch ESPN expert picks/predictions from their public API.
 */
async function fetchEspnPredictions(sport: 'nba' | 'mlb'): Promise<ExpertPick[]> {
  const espnSport = sport === 'nba' ? 'basketball/nba' : 'baseball/mlb';
  const picks: ExpertPick[] = [];
  const now = new Date().toISOString();

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/scoreboard`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];

    const data = await res.json();

    for (const event of data.events ?? []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      // ESPN sometimes includes pickcenter predictions
      const pickcenter = comp.pickcenter;
      if (pickcenter && Array.isArray(pickcenter)) {
        for (const pick of pickcenter) {
          const provider = pick.provider?.name ?? 'ESPN';
          const homeTeam = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home')?.team?.displayName ?? '';
          const awayTeam = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away')?.team?.displayName ?? '';

          if (pick.homeTeamOdds?.value != null) {
            const homePct = pick.homeTeamOdds.value;
            const favored = homePct > 50 ? homeTeam : awayTeam;
            const pct = homePct > 50 ? homePct : 100 - homePct;

            picks.push({
              expert_name: provider,
              source: 'ESPN Predicciones',
              source_url: `https://www.espn.com/${sport}`,
              sport,
              pick_type: 'moneyline',
              pick_description: `${favored} ${pct.toFixed(0)}% favorito (${awayTeam} @ ${homeTeam})`,
              confidence: pct > 65 ? 'alta' : pct > 55 ? 'media' : 'baja',
              record: `ESPN ${provider}`,
              profit_units: null,
              scraped_at: now,
            });
          }
        }
      }
    }
  } catch {
    // ok
  }

  return picks;
}

/**
 * Aggregate all expert picks for a sport.
 */
export async function fetchAllExpertPicks(
  sport: 'nba' | 'mlb'
): Promise<ExpertPick[]> {
  let socialPicks: ExpertPick[] = [];
  try {
    const { fetchSocialPicks } = await import('./social');
    socialPicks = await fetchSocialPicks(sport);
  } catch { /* ok */ }

  const [reddit, espn] = await Promise.all([
    fetchRedditPicks(sport).catch(() => []),
    fetchEspnPredictions(sport).catch(() => []),
  ]);

  return [...reddit, ...espn, ...socialPicks];
}
