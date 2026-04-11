/**
 * Player/team stats scrapers for NBA and MLB.
 * balldontlie.io for NBA (needs API key)
 * MLB Stats API (statsapi.mlb.com, 100% free, no key)
 */

// ═══ NBA Stats (balldontlie.io) ═══

/**
 * Free NBA team standings via ESPN (no API key required).
 * Returns a map of team display name → {win_pct, avg_points, recent_form}.
 * Used as a fallback when BALLDONTLIE_API_KEY is not set.
 */
export async function fetchNbaStandingsEspn(): Promise<Map<string, { win_pct: number; avg_points?: number; recent_form?: string }>> {
  const out = new Map<string, { win_pct: number; avg_points?: number; recent_form?: string }>();
  try {
    const res = await fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return out;
    const data = await res.json() as {
      children?: Array<{
        standings?: { entries?: Array<{
          team: { displayName: string };
          stats: Array<{ name: string; value: number; displayValue: string }>;
        }> };
      }>;
    };
    for (const conf of data.children ?? []) {
      for (const entry of conf.standings?.entries ?? []) {
        const name = entry.team.displayName;
        const statsByName = new Map(entry.stats.map((s) => [s.name, s.value]));
        const winPct = statsByName.get('winPercent') ?? 0;
        const avgPoints = statsByName.get('avgPointsFor');
        const streakVal = entry.stats.find((s) => s.name === 'streak')?.displayValue ?? '';
        out.set(name, { win_pct: winPct, avg_points: avgPoints, recent_form: streakVal });
      }
    }
  } catch { /* ok */ }
  return out;
}

export interface NbaTeamStats {
  team_name: string;
  avg_points: number;
  avg_rebounds: number;
  avg_assists: number;
  win_pct: number;
  recent_form: string; // e.g., "W-W-L-W-W"
}

async function fetchBdl<T>(path: string): Promise<T | null> {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.balldontlie.io/v1${path}`, {
      cache: 'no-store',
      headers: { Authorization: key },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch { return null; }
}

/**
 * Get NBA team season stats for the current season.
 */
export async function fetchNbaTeamStats(teamName: string): Promise<NbaTeamStats | null> {
  // Search for team
  const searchData = await fetchBdl<{ data: Array<{ id: number; full_name: string; abbreviation: string }> }>(
    `/teams?search=${encodeURIComponent(teamName)}`
  );
  if (!searchData?.data?.[0]) return null;

  const teamId = searchData.data[0].id;

  // Get recent games
  const gamesData = await fetchBdl<{ data: Array<{ home_team_score: number; visitor_team_score: number; home_team: { id: number }; visitor_team: { id: number }; status: string }> }>(
    `/games?team_ids[]=${teamId}&seasons[]=2025&per_page=10`
  );

  if (!gamesData?.data) return null;

  const games = gamesData.data.filter((g) => g.status === 'Final');
  if (games.length === 0) return null;

  let totalPts = 0;
  let wins = 0;
  const form: string[] = [];

  for (const g of games.slice(0, 10)) {
    const isHome = g.home_team.id === teamId;
    const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
    const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
    totalPts += teamScore;
    const won = teamScore > oppScore;
    if (won) wins++;
    form.push(won ? 'W' : 'L');
  }

  return {
    team_name: searchData.data[0].full_name,
    avg_points: totalPts / games.length,
    avg_rebounds: 0,
    avg_assists: 0,
    win_pct: wins / games.length,
    recent_form: form.slice(0, 5).join('-'),
  };
}

// ═══ MLB Stats (statsapi.mlb.com - 100% free, no key) ═══

export interface MlbTeamStats {
  team_name: string;
  wins: number;
  losses: number;
  win_pct: number;
  runs_per_game: number;
  era: number;
  recent_form: string;
}

interface MlbStandingsRecord {
  team: { name: string };
  wins: number;
  losses: number;
  winningPercentage: string;
  runsScored: number;
  runsAllowed: number;
  gamesPlayed: number;
}

/**
 * Get MLB team stats from the official MLB Stats API (free, no key).
 */
export async function fetchMlbTeamStats(teamName: string): Promise<MlbTeamStats | null> {
  try {
    // Get current standings
    const res = await fetch(
      'https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason',
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const data = await res.json() as { records: Array<{ teamRecords: MlbStandingsRecord[] }> };

    for (const record of data.records ?? []) {
      for (const team of record.teamRecords ?? []) {
        const name = team.team.name.toLowerCase();
        if (teamName.toLowerCase().includes(name) || name.includes(teamName.toLowerCase().split(' ').pop() ?? '')) {
          return {
            team_name: team.team.name,
            wins: team.wins,
            losses: team.losses,
            win_pct: parseFloat(team.winningPercentage) || team.wins / (team.wins + team.losses),
            runs_per_game: team.gamesPlayed > 0 ? team.runsScored / team.gamesPlayed : 0,
            era: team.gamesPlayed > 0 ? (team.runsAllowed / team.gamesPlayed) * 9 : 0,
            recent_form: '',
          };
        }
      }
    }
    return null;
  } catch { return null; }
}

/**
 * Compare two teams and return a win probability estimate based on stats.
 * Simple log5 method.
 */
export function estimateWinProbability(
  teamAWinPct: number,
  teamBWinPct: number
): { teamA: number; teamB: number } {
  // Log5 formula
  const pA = (teamAWinPct - teamAWinPct * teamBWinPct) /
    (teamAWinPct + teamBWinPct - 2 * teamAWinPct * teamBWinPct);
  return { teamA: pA, teamB: 1 - pA };
}
