/**
 * Advanced betting signals computed from free data sources.
 * Signals 13-20 for the correlation engine.
 */

// ─── Signal 13: Back-to-back / Fatigue ───
export interface FatigueSignal {
  event_id: string;
  team_name: string;
  is_back_to_back: boolean;
  days_rest: number;
  advantage: 'rested' | 'fatigued' | 'neutral';
  description: string;
}

export function detectFatigue(
  eventId: string,
  teamName: string,
  teamGames: Array<{ commence_time: string; completed: boolean }>,
  gameTime: string
): FatigueSignal {
  const target = new Date(gameTime).getTime();
  const recent = teamGames
    .filter((g) => g.completed && new Date(g.commence_time).getTime() < target)
    .sort((a, b) => new Date(b.commence_time).getTime() - new Date(a.commence_time).getTime());

  if (recent.length === 0) {
    return { event_id: eventId, team_name: teamName, is_back_to_back: false, days_rest: 3, advantage: 'neutral', description: 'Sin data de juegos recientes' };
  }

  const lastGame = new Date(recent[0].commence_time).getTime();
  const hoursRest = (target - lastGame) / (1000 * 60 * 60);
  const daysRest = Math.floor(hoursRest / 24);
  const isB2B = hoursRest < 28; // Less than 28 hours = back to back

  let advantage: 'rested' | 'fatigued' | 'neutral' = 'neutral';
  let desc = `${daysRest} dias de descanso`;

  if (isB2B) {
    advantage = 'fatigued';
    desc = `Back-to-back (${hoursRest.toFixed(0)}h descanso). Rendimiento baja ~3-5%.`;
  } else if (daysRest >= 3) {
    advantage = 'rested';
    desc = `${daysRest} dias descansados. Ventaja de energia.`;
  }

  return { event_id: eventId, team_name: teamName, is_back_to_back: isB2B, days_rest: daysRest, advantage, description: desc };
}

// ─── Signal 14: Home/Away advantage ───
export interface HomeAwaySignal {
  event_id: string;
  team_name: string;
  is_home: boolean;
  home_advantage_pct: number; // typically 55-60% for NBA, 53-55% for MLB
  description: string;
}

export function computeHomeAdvantage(
  eventId: string,
  homeTeam: string,
  awayTeam: string,
  sport: string
): HomeAwaySignal[] {
  // Historical home win rates
  const homeWinRate = sport === 'basketball_nba' ? 0.58 : 0.54; // NBA ~58%, MLB ~54%

  return [
    {
      event_id: eventId,
      team_name: homeTeam,
      is_home: true,
      home_advantage_pct: homeWinRate,
      description: `Home: ${(homeWinRate * 100).toFixed(0)}% win rate historico en casa`,
    },
    {
      event_id: eventId,
      team_name: awayTeam,
      is_home: false,
      home_advantage_pct: 1 - homeWinRate,
      description: `Away: ${((1 - homeWinRate) * 100).toFixed(0)}% win rate historico visitante`,
    },
  ];
}

// ─── Signal 15: Pace of Play (NBA) ───
// High pace teams score more -> affects totals
export interface PaceSignal {
  event_id: string;
  combined_pace: 'fast' | 'slow' | 'average';
  total_adjustment: number; // points added/subtracted to expected total
  description: string;
}

// NBA team pace ratings (possessions per 48 min, approximate 2025-26)
const NBA_PACE: Record<string, number> = {
  'Indiana Pacers': 103, 'Atlanta Hawks': 102, 'Sacramento Kings': 101,
  'Milwaukee Bucks': 101, 'New Orleans Pelicans': 100, 'Portland Trail Blazers': 100,
  'Oklahoma City Thunder': 99, 'Dallas Mavericks': 99, 'Denver Nuggets': 99,
  'Golden State Warriors': 99, 'Phoenix Suns': 98, 'Los Angeles Lakers': 98,
  'Minnesota Timberwolves': 98, 'Houston Rockets': 98, 'Cleveland Cavaliers': 97,
  'Boston Celtics': 97, 'Toronto Raptors': 97, 'Chicago Bulls': 97,
  'Brooklyn Nets': 97, 'Detroit Pistons': 97, 'San Antonio Spurs': 97,
  'Miami Heat': 96, 'Philadelphia 76ers': 96, 'Charlotte Hornets': 96,
  'Orlando Magic': 96, 'Washington Wizards': 96, 'Memphis Grizzlies': 96,
  'New York Knicks': 95, 'Utah Jazz': 95, 'LA Clippers': 95,
};
const AVG_PACE = 97.5;

export function computePace(
  eventId: string,
  homeTeam: string,
  awayTeam: string
): PaceSignal | null {
  const homePace = NBA_PACE[homeTeam];
  const awayPace = NBA_PACE[awayTeam];
  if (!homePace || !awayPace) return null;

  const avgPace = (homePace + awayPace) / 2;
  const diff = avgPace - AVG_PACE;
  const adjustment = diff * 2.2; // ~2.2 points per pace unit

  let combined: 'fast' | 'slow' | 'average' = 'average';
  if (avgPace > 99) combined = 'fast';
  else if (avgPace < 96) combined = 'slow';

  return {
    event_id: eventId,
    combined_pace: combined,
    total_adjustment: adjustment,
    description: `Pace: ${homeTeam} (${homePace}) vs ${awayTeam} (${awayPace}) = ${avgPace.toFixed(1)} avg. ${combined === 'fast' ? 'Favorece OVER (+' + adjustment.toFixed(0) + ' pts)' : combined === 'slow' ? 'Favorece UNDER (' + adjustment.toFixed(0) + ' pts)' : 'Neutral'}`,
  };
}

// ─── Signal 16: Altitude (Coors Field) ───
export interface AltitudeSignal {
  event_id: string;
  is_high_altitude: boolean;
  park_factor: number; // 1.0 = average, >1.0 = hitter friendly
  description: string;
}

const PARK_FACTORS: Record<string, number> = {
  'Colorado Rockies': 1.38, // Coors Field - extreme hitter friendly
  'Cincinnati Reds': 1.12,
  'Arizona Diamondbacks': 1.08,
  'Boston Red Sox': 1.07, // Fenway Park
  'Chicago Cubs': 1.06, // Wrigley Field
  'Philadelphia Phillies': 1.05,
  'Texas Rangers': 1.04,
  'Toronto Blue Jays': 1.03,
  'Baltimore Orioles': 1.02,
  'Milwaukee Brewers': 0.97,
  'San Diego Padres': 0.96,
  'Tampa Bay Rays': 0.95,
  'Oakland Athletics': 0.94,
  'Miami Marlins': 0.93,
  'San Francisco Giants': 0.92,
  'Seattle Mariners': 0.91,
  'Los Angeles Dodgers': 0.95,
};

export function computeAltitude(eventId: string, homeTeam: string): AltitudeSignal {
  const factor = PARK_FACTORS[homeTeam] ?? 1.0;
  const isHigh = homeTeam === 'Colorado Rockies';

  let desc = `Park factor: ${factor.toFixed(2)}`;
  if (factor > 1.1) desc += '. Estadio favorece bateadores -> OVER.';
  else if (factor < 0.95) desc += '. Estadio favorece pitchers -> UNDER.';

  if (isHigh) desc = `Coors Field (5,280 ft altitud). Bola viaja 5-10% mas lejos. Fuerte OVER.`;

  return { event_id: eventId, is_high_altitude: isHigh, park_factor: factor, description: desc };
}

// ─── Signal 18: Closing Line Value ───
export interface CLVSignal {
  event_id: string;
  market_key: string;
  outcome_name: string;
  opening_odds: number;
  current_odds: number;
  clv: number; // positive = we got better odds than closing
  description: string;
}

export function computeCLV(
  eventId: string,
  marketKey: string,
  outcomeName: string,
  snapshots: Array<{ odds: number; fetched_at: string }>
): CLVSignal | null {
  if (snapshots.length < 2) return null;

  const sorted = [...snapshots].sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime());
  const opening = sorted[0].odds;
  const current = sorted[sorted.length - 1].odds;

  // CLV = how much the line moved against us (negative = market agreed with us)
  const clv = current - opening;

  if (Math.abs(clv) < 5) return null; // Insignificant movement

  return {
    event_id: eventId,
    market_key: marketKey,
    outcome_name: outcomeName,
    opening_odds: opening,
    current_odds: current,
    clv,
    description: `CLV: Linea abrio ${opening > 0 ? '+' : ''}${opening}, ahora ${current > 0 ? '+' : ''}${current}. ${clv < 0 ? 'Mercado se movio a nuestro favor (sharp agreement).' : 'Mercado se movio en contra.'}`,
  };
}

// ─── Signal 19: Hot/Cold Streaks & Regression ───
export interface StreakSignal {
  event_id: string;
  team_name: string;
  streak_type: 'hot' | 'cold' | 'neutral';
  streak_length: number;
  regression_likely: boolean;
  description: string;
}

export function detectStreak(
  eventId: string,
  teamName: string,
  recentResults: Array<{ won: boolean }>
): StreakSignal {
  if (recentResults.length < 3) {
    return { event_id: eventId, team_name: teamName, streak_type: 'neutral', streak_length: 0, regression_likely: false, description: 'Datos insuficientes' };
  }

  let streak = 0;
  const lastResult = recentResults[0].won;
  for (const r of recentResults) {
    if (r.won === lastResult) streak++;
    else break;
  }

  const wins = recentResults.slice(0, 10).filter((r) => r.won).length;
  const winRate = wins / Math.min(recentResults.length, 10);

  let type: 'hot' | 'cold' | 'neutral' = 'neutral';
  let regression = false;

  if (streak >= 5 && lastResult) {
    type = 'hot';
    regression = winRate > 0.75; // Unsustainable win rate
  } else if (streak >= 5 && !lastResult) {
    type = 'cold';
    regression = winRate < 0.25; // Unsustainable loss rate
  } else if (winRate > 0.7) {
    type = 'hot';
  } else if (winRate < 0.3) {
    type = 'cold';
  }

  const desc = type === 'hot'
    ? `Racha caliente: ${streak}${lastResult ? 'W' : 'L'} seguidas, ${(winRate * 100).toFixed(0)}% ultimos 10. ${regression ? 'REGRESION probable.' : ''}`
    : type === 'cold'
      ? `Racha fria: ${streak}${lastResult ? 'W' : 'L'} seguidas, ${(winRate * 100).toFixed(0)}% ultimos 10. ${regression ? 'REGRESION probable (mejora esperada).' : ''}`
      : `Neutral: ${(winRate * 100).toFixed(0)}% ultimos 10 juegos.`;

  return { event_id: eventId, team_name: teamName, streak_type: type, streak_length: streak, regression_likely: regression, description: desc };
}

// ─── Signal 20: Playoff Implications ───
export interface PlayoffSignal {
  event_id: string;
  team_name: string;
  motivation: 'high' | 'medium' | 'low';
  description: string;
}

export function computePlayoffMotivation(
  eventId: string,
  teamName: string,
  winPct: number,
  gamesRemaining: number,
  isPlayoffTeam: boolean
): PlayoffSignal {
  let motivation: 'high' | 'medium' | 'low' = 'medium';
  let desc = '';

  if (gamesRemaining <= 5 && winPct > 0.45 && winPct < 0.55) {
    motivation = 'high';
    desc = `Pelea por playoff: ${(winPct * 100).toFixed(0)}% con ${gamesRemaining} juegos restantes. Motivacion MAXIMA.`;
  } else if (winPct < 0.30 && gamesRemaining > 10) {
    motivation = 'low';
    desc = `Eliminados: ${(winPct * 100).toFixed(0)}%. Pueden descansar jugadores.`;
  } else if (isPlayoffTeam && gamesRemaining <= 10) {
    motivation = 'high';
    desc = `Equipo de playoff asegurando seeding. ${gamesRemaining} juegos restantes.`;
  } else {
    desc = `Motivacion normal: ${(winPct * 100).toFixed(0)}% win rate.`;
  }

  return { event_id: eventId, team_name: teamName, motivation, description: desc };
}
