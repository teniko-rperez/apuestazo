export const SPORTS = {
  basketball_nba: { key: 'basketball_nba', name: 'NBA', emoji: '🏀' },
  baseball_mlb: { key: 'baseball_mlb', name: 'MLB', emoji: '⚾' },
} as const;

export type SportKey = keyof typeof SPORTS;

export const BOOKMAKERS: Record<string, { name: string; color: string }> = {
  draftkings: { name: 'DraftKings', color: '#53d337' },
  fanduel: { name: 'FanDuel', color: '#1493ff' },
  betmgm: { name: 'BetMGM', color: '#bfa053' },
  williamhill_us: { name: 'Caesars', color: '#00833e' },
  pointsbetus: { name: 'PointsBet', color: '#e44c30' },
  betrivers: { name: 'BetRivers', color: '#1a1a2e' },
};

export const BOOKMAKERS_EXTRA: Record<string, { name: string; color: string }> = {
  espnbet: { name: 'ESPN BET', color: '#ff4747' },
};

Object.assign(BOOKMAKERS, BOOKMAKERS_EXTRA);

export const BOOKMAKER_KEYS = Object.keys(BOOKMAKERS);

export const MARKET_LABELS: Record<string, string> = {
  h2h: 'Ganador',
  spreads: 'Handicap',
  totals: 'Total',
  player_points: 'Puntos Jugador',
  player_rebounds: 'Rebotes Jugador',
  player_assists: 'Asistencias Jugador',
  player_threes: 'Triples Jugador',
  batter_hits: 'Hits Bateador',
  batter_total_bases: 'Bases Totales',
  batter_home_runs: 'Jonrones',
  pitcher_strikeouts: 'Ponches Lanzador',
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/nba', label: 'NBA' },
  { href: '/mlb', label: 'MLB' },
  { href: '/arbitraje', label: 'Arbitraje' },
  { href: '/valor', label: 'Valor +EV' },
  { href: '/props', label: 'Props' },
  { href: '/expertos', label: 'Expertos' },
  { href: '/simulaciones', label: 'Simulador' },
];

export const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
export const MONTHLY_CREDIT_LIMIT = 500;
export const EMERGENCY_CREDIT_THRESHOLD = 50;
