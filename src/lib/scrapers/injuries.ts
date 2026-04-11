/**
 * Injury scraper for NBA and MLB.
 * Uses ESPN's free injury API — no key required.
 * Focuses on star players (high minutes/games) and their game status.
 */

export interface PlayerInjury {
  player_name: string;
  team_name: string;
  status: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE' | 'DAY_TO_DAY';
  description: string;
  is_star: boolean; // Top player on the team by impact
}

export interface TeamInjuryReport {
  team_name: string;
  sport: 'nba' | 'mlb';
  injuries: PlayerInjury[];
  star_out_count: number; // Stars confirmed OUT or DOUBTFUL
  total_out_count: number;
  impact: 'critical' | 'significant' | 'minor' | 'none';
  description: string;
}

interface EspnInjuryResponse {
  injuries?: Array<{
    displayName?: string; // Team name is directly on the entry, NOT nested under team
    team?: { displayName?: string }; // fallback
    injuries?: Array<{
      athlete?: { displayName?: string; position?: { abbreviation?: string } };
      status?: string; // "Out", "Questionable", "Day-To-Day", "Doubtful", "Probable"
      shortComment?: string;
      details?: { detail?: string; type?: string };
    }>;
  }>;
}

// Key positions that are "star" positions by default
const NBA_KEY_POSITIONS = new Set(['PG', 'SG', 'SF', 'PF', 'C']); // All positions matter in NBA
const MLB_KEY_POSITIONS = new Set(['SP', 'CP', 'SS', 'CF', 'C', '1B', '3B']); // Pitchers + key fielders

function normalizeStatus(raw?: string): PlayerInjury['status'] {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('out')) return 'OUT';
  if (s.includes('doubtful')) return 'DOUBTFUL';
  if (s.includes('questionable')) return 'QUESTIONABLE';
  if (s.includes('probable')) return 'PROBABLE';
  if (s.includes('day')) return 'DAY_TO_DAY';
  return 'QUESTIONABLE';
}

function isLikelyOut(status: PlayerInjury['status']): boolean {
  return status === 'OUT' || status === 'DOUBTFUL';
}

async function fetchEspnInjuries(sport: 'basketball/nba' | 'baseball/mlb'): Promise<TeamInjuryReport[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/injuries`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 ApuestazBot/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as EspnInjuryResponse;
    if (!data.injuries) return [];

    const isNba = sport.includes('nba');
    const keyPositions = isNba ? NBA_KEY_POSITIONS : MLB_KEY_POSITIONS;
    const reports: TeamInjuryReport[] = [];

    for (const team of data.injuries) {
      const teamName = team.displayName ?? team.team?.displayName ?? '';
      if (!teamName || !team.injuries) continue;

      const injuries: PlayerInjury[] = [];
      for (const inj of team.injuries) {
        const playerName = inj.athlete?.displayName ?? '';
        const position = inj.athlete?.position?.abbreviation ?? '';
        const status = normalizeStatus(inj.status);
        const detail = inj.details?.detail ?? inj.details?.type ?? inj.shortComment ?? '';

        if (!playerName) continue;

        // A player is considered a "star" if they play a key position
        // ESPN lists injuries roughly by importance, so first few are usually starters
        const isStar = keyPositions.has(position);

        injuries.push({
          player_name: playerName,
          team_name: teamName,
          status,
          description: detail ? `${playerName} (${position}) - ${status}: ${detail}` : `${playerName} (${position}) - ${status}`,
          is_star: isStar,
        });
      }

      const starOutCount = injuries.filter((i) => i.is_star && isLikelyOut(i.status)).length;
      const totalOutCount = injuries.filter((i) => isLikelyOut(i.status)).length;

      let impact: TeamInjuryReport['impact'] = 'none';
      let description = `${teamName}: sin lesiones significativas.`;

      if (starOutCount >= 3) {
        impact = 'critical';
        description = `${teamName}: ${starOutCount} jugadores clave OUT/DOUBTFUL. Impacto CRITICO.`;
      } else if (starOutCount >= 2) {
        impact = 'significant';
        description = `${teamName}: ${starOutCount} jugadores clave OUT/DOUBTFUL. Impacto significativo.`;
      } else if (starOutCount >= 1 || totalOutCount >= 3) {
        impact = 'minor';
        description = `${teamName}: ${starOutCount} estrella(s) y ${totalOutCount} total OUT/DOUBTFUL.`;
      }

      if (injuries.length > 0) {
        // Add top injured player names to description
        const topOut = injuries
          .filter((i) => isLikelyOut(i.status))
          .slice(0, 3)
          .map((i) => i.player_name);
        if (topOut.length > 0) {
          description += ` Fuera: ${topOut.join(', ')}.`;
        }
      }

      reports.push({
        team_name: teamName,
        sport: isNba ? 'nba' : 'mlb',
        injuries,
        star_out_count: starOutCount,
        total_out_count: totalOutCount,
        impact,
        description,
      });
    }

    return reports;
  } catch {
    return [];
  }
}

export async function fetchNbaInjuries(): Promise<TeamInjuryReport[]> {
  return fetchEspnInjuries('basketball/nba');
}

export async function fetchMlbInjuries(): Promise<TeamInjuryReport[]> {
  return fetchEspnInjuries('baseball/mlb');
}

export async function fetchAllInjuries(): Promise<TeamInjuryReport[]> {
  const [nba, mlb] = await Promise.all([fetchNbaInjuries(), fetchMlbInjuries()]);
  return [...nba, ...mlb];
}
