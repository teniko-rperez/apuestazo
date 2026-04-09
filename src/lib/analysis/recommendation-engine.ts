/**
 * Unified Recommendation Engine.
 * Correlates ALL signals to produce the safest, highest-confidence bets.
 *
 * Signals used:
 * 1. +EV edge (power devig)
 * 2. Arbitrage detection
 * 3. Line movement / steam moves
 * 4. Expert consensus (Covers, Reddit, Twitter)
 * 5. Odds discrepancies across books
 * 6. Public betting consensus
 * 7. Historical simulated bet performance (feedback loop)
 * 8. Robinhood/Kalshi prediction market prices
 */

import { americanToDecimal, americanToImplied, formatOdds, formatPct } from './implied-probability';
import type { ArbResult } from './arbitrage';
import type { EvResult } from './expected-value';
import type { LineMovement, SteamMove } from './line-movement';
import type { ParlayCombo } from './parlay-builder';
import type { ExpertPick } from '@/lib/scrapers/experts';
import type { KalshiContract } from '@/lib/scrapers/kalshi';
import type { NbaTeamStats, MlbTeamStats } from '@/lib/scrapers/stats';
import type { WeatherData } from '@/lib/scrapers/weather';
import type { PolyContract } from '@/lib/scrapers/polymarket';
import type { FatigueSignal, HomeAwaySignal, PaceSignal, AltitudeSignal, CLVSignal, StreakSignal, PlayoffSignal } from './advanced-signals';

export interface EngineInput {
  arbs: ArbResult[];
  evs: EvResult[];
  expertPicks: ExpertPick[];
  lineMovements: LineMovement[];
  steamMoves: SteamMove[];
  consensus: Array<{
    event_name: string;
    home_team: string;
    away_team: string;
    home_spread_pct: number;
    away_spread_pct: number;
    over_pct: number;
    under_pct: number;
  }>;
  discrepancies: Array<{
    event_id: string;
    market_key: string;
    outcome_name: string;
    max_odds: number;
    min_odds: number;
    max_bookmaker: string;
    min_bookmaker: string;
    discrepancy: number;
  }>;
  parlays: ParlayCombo[];
  kalshiContracts: KalshiContract[];
  teamStats: Map<string, { win_pct: number; avg_points?: number; recent_form?: string }>;
  weather: Map<string, WeatherData>;
  polymarket: PolyContract[];
  fatigue: FatigueSignal[];
  homeAway: HomeAwaySignal[];
  pace: PaceSignal[];
  altitude: AltitudeSignal[];
  clv: CLVSignal[];
  streaks: StreakSignal[];
  playoff: PlayoffSignal[];
  eventTeams: Map<string, { home_team: string; away_team: string }>;
}

export interface ScoredRecommendation {
  event_id: string;
  type: string;
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  reasoning: string;
  confidence_score: number;
  valid_until: string;
  signals: string[];
  signal_count: number;
}

/**
 * Main recommendation engine.
 * Scores each potential bet by counting corroborating signals.
 * More signals agreeing = safer bet.
 */
export function generateRecommendations(input: EngineInput): ScoredRecommendation[] {
  const candidates = new Map<string, {
    event_id: string;
    market_key: string;
    outcome_name: string;
    bookmaker_key: string;
    odds: number;
    signals: string[];
    scores: number[];
    reasonParts: string[];
  }>();

  function getKey(eventId: string, marketKey: string, outcomeName: string) {
    return `${eventId}|${marketKey}|${outcomeName}`;
  }

  function addSignal(
    eventId: string,
    marketKey: string,
    outcomeName: string,
    bookmakerKey: string,
    odds: number,
    signalName: string,
    score: number,
    reason: string
  ) {
    const key = getKey(eventId, marketKey, outcomeName);
    if (!candidates.has(key)) {
      candidates.set(key, {
        event_id: eventId,
        market_key: marketKey,
        outcome_name: outcomeName,
        bookmaker_key: bookmakerKey,
        odds,
        signals: [],
        scores: [],
        reasonParts: [],
      });
    }
    const c = candidates.get(key)!;
    c.signals.push(signalName);
    c.scores.push(score);
    c.reasonParts.push(reason);
    // Keep best odds
    if (Math.abs(odds) > 0 && (c.odds === 0 || odds > c.odds)) {
      c.odds = odds;
      c.bookmaker_key = bookmakerKey;
    }
  }

  // ─── Signal 1: +EV Edge ───
  for (const ev of input.evs) {
    const score = ev.confidence === 'alta' ? 0.30 : ev.confidence === 'media' ? 0.20 : 0.12;
    addSignal(
      ev.event_id,
      ev.market_key,
      ev.outcome_name,
      ev.bookmaker_key,
      ev.odds,
      'EV',
      score,
      `+EV ${formatPct(ev.edge_pct)} ventaja (${ev.confidence})`
    );
  }

  // ─── Signal 2: Arbitrage ───
  for (const arb of input.arbs) {
    for (const leg of arb.legs) {
      addSignal(
        arb.event_id,
        arb.market_key,
        leg.outcome_name,
        leg.bookmaker,
        leg.odds,
        'ARB',
        0.25,
        `Parte de arbitraje ${formatPct(arb.profit_margin)} profit`
      );
    }
  }

  // ─── Signal 3: Steam Moves (sharp money) ───
  for (const steam of input.steamMoves) {
    // Steam move = 3+ books moving same direction = sharp action
    const score = steam.bookmakers_moving.length >= 4 ? 0.25 : 0.18;
    addSignal(
      steam.event_id,
      steam.market_key,
      steam.outcome_name,
      steam.bookmakers_moving[0],
      0, // odds unknown from steam alone
      'STEAM',
      score,
      `Steam move: ${steam.bookmakers_moving.length} casas movieron ${steam.direction} (${steam.average_change > 0 ? '+' : ''}${steam.average_change.toFixed(0)})`
    );
  }

  // ─── Signal 4: Line Movement (significant) ───
  for (const lm of input.lineMovements) {
    if (!lm.is_significant) continue;
    // Significant line movement toward an outcome = market believes in it
    const moveFavorable = lm.direction === 'down'; // odds going down = more likely
    if (moveFavorable) {
      addSignal(
        lm.event_id,
        lm.market_key,
        lm.outcome_name,
        lm.bookmaker_key,
        lm.current_odds,
        'LINE_MOVE',
        0.10,
        `Linea se movio ${lm.change > 0 ? '+' : ''}${lm.change} (de ${formatOdds(lm.previous_odds)} a ${formatOdds(lm.current_odds)})`
      );
    }
  }

  // ─── Signal 5: Expert Consensus ───
  // Group expert picks by team/outcome mentioned
  const expertByTeam = new Map<string, { count: number; totalConf: number; sources: string[] }>();

  for (const pick of input.expertPicks) {
    const desc = pick.pick_description.toLowerCase();
    // Try to match expert pick to an event
    for (const [eventId, teams] of input.eventTeams) {
      const homeLC = teams.home_team.toLowerCase();
      const awayLC = teams.away_team.toLowerCase();
      // Check if pick mentions either team
      const homeWords = homeLC.split(' ');
      const awayWords = awayLC.split(' ');
      const matchesHome = homeWords.some((w) => w.length > 3 && desc.includes(w));
      const matchesAway = awayWords.some((w) => w.length > 3 && desc.includes(w));

      if (matchesHome || matchesAway) {
        const teamName = matchesHome ? teams.home_team : teams.away_team;
        const key = `${eventId}|${teamName}`;
        const existing = expertByTeam.get(key) ?? { count: 0, totalConf: 0, sources: [] };
        existing.count++;
        existing.totalConf += pick.confidence === 'alta' ? 3 : pick.confidence === 'media' ? 2 : 1;
        existing.sources.push(pick.source);
        expertByTeam.set(key, existing);
      }
    }
  }

  for (const [key, data] of expertByTeam) {
    const [eventId, teamName] = key.split('|');
    if (data.count >= 2) {
      // Multiple experts agree = strong signal
      const score = data.count >= 3 ? 0.22 : 0.15;
      const uniqueSources = [...new Set(data.sources)];
      addSignal(
        eventId,
        'h2h',
        teamName,
        'draftkings', // default book
        0,
        'EXPERT',
        score,
        `${data.count} expertos coinciden (${uniqueSources.join(', ')})`
      );
    }
  }

  // ─── Signal 6: Odds Discrepancies ───
  for (const disc of input.discrepancies) {
    if (disc.discrepancy > 30) {
      // Big discrepancy = one book has significantly different opinion
      // Bet at the book with best odds
      addSignal(
        disc.event_id,
        disc.market_key,
        disc.outcome_name,
        disc.max_bookmaker,
        disc.max_odds,
        'DISCREPANCY',
        0.12,
        `Discrepancia de ${disc.discrepancy} entre ${disc.max_bookmaker} (${formatOdds(disc.max_odds)}) y ${disc.min_bookmaker} (${formatOdds(disc.min_odds)})`
      );
    }
  }

  // ─── Signal 7: Public Consensus (contrarian value) ───
  for (const cons of input.consensus) {
    // If public is heavily on one side (>65%), the other side often has value
    for (const [eventId, teams] of input.eventTeams) {
      if (teams.home_team === cons.home_team || teams.away_team === cons.away_team) {
        if (cons.away_spread_pct > 65) {
          addSignal(eventId, 'spreads', cons.home_team, 'draftkings', 0,
            'CONTRARIAN', 0.10,
            `${formatPct(cons.away_spread_pct / 100)} del publico en ${cons.away_team}, valor contrario en ${cons.home_team}`
          );
        } else if (cons.home_spread_pct > 65) {
          addSignal(eventId, 'spreads', cons.away_team, 'draftkings', 0,
            'CONTRARIAN', 0.10,
            `${formatPct(cons.home_spread_pct / 100)} del publico en ${cons.home_team}, valor contrario en ${cons.away_team}`
          );
        }
        break;
      }
    }
  }

  // ─── Signal 8: Robinhood/Kalshi Prediction Markets ───
  // If Kalshi has a contract with high implied prob for a team, it corroborates
  for (const contract of input.kalshiContracts) {
    if (!contract.yes_price || contract.yes_price === 0) continue;

    const impliedProb = contract.yes_price / 100;
    const contractText = `${contract.title} ${contract.subtitle}`.toLowerCase();

    for (const [eventId, teams] of input.eventTeams) {
      const homeLC = teams.home_team.toLowerCase();
      const awayLC = teams.away_team.toLowerCase();
      const homeWords = homeLC.split(' ').filter((w) => w.length > 3);
      const awayWords = awayLC.split(' ').filter((w) => w.length > 3);

      const matchesHome = homeWords.some((w) => contractText.includes(w));
      const matchesAway = awayWords.some((w) => contractText.includes(w));

      if (matchesHome && impliedProb > 0.55) {
        // Kalshi market thinks home team wins with >55% prob
        const score = impliedProb > 0.75 ? 0.22 : impliedProb > 0.65 ? 0.18 : 0.12;
        addSignal(eventId, 'h2h', teams.home_team, 'draftkings', 0,
          'ROBINHOOD', score,
          `Robinhood/Kalshi: ${teams.home_team} a ${contract.yes_price}¢ (${(impliedProb * 100).toFixed(0)}% prob)`
        );
      } else if (matchesAway && impliedProb > 0.55) {
        const score = impliedProb > 0.75 ? 0.22 : impliedProb > 0.65 ? 0.18 : 0.12;
        addSignal(eventId, 'h2h', teams.away_team, 'draftkings', 0,
          'ROBINHOOD', score,
          `Robinhood/Kalshi: ${teams.away_team} a ${contract.yes_price}¢ (${(impliedProb * 100).toFixed(0)}% prob)`
        );
      }

      // Check for over/under contracts
      const overMatch = contractText.match(/over\s+(\d+\.?\d*)\s+points/);
      if (overMatch && (matchesHome || matchesAway) && impliedProb > 0.55) {
        const score = impliedProb > 0.65 ? 0.18 : 0.12;
        addSignal(eventId, 'totals', 'Over', 'draftkings', 0,
          'ROBINHOOD', score,
          `Robinhood/Kalshi: Over ${overMatch[1]} a ${contract.yes_price}¢ (${(impliedProb * 100).toFixed(0)}%)`
        );
      }
    }
  }

  // ─── Signal 9: Team Stats (win%, form, log5 probability) ───
  for (const [eventId, teams] of input.eventTeams) {
    const homeStats = input.teamStats.get(teams.home_team);
    const awayStats = input.teamStats.get(teams.away_team);

    if (homeStats && awayStats) {
      // Use log5 to estimate who should win
      const homeProb = (homeStats.win_pct - homeStats.win_pct * awayStats.win_pct) /
        (homeStats.win_pct + awayStats.win_pct - 2 * homeStats.win_pct * awayStats.win_pct);

      if (homeProb > 0.60) {
        const score = homeProb > 0.70 ? 0.20 : 0.14;
        const form = homeStats.recent_form ? ` (racha: ${homeStats.recent_form})` : '';
        addSignal(eventId, 'h2h', teams.home_team, 'draftkings', 0,
          'STATS', score,
          `Stats: ${teams.home_team} ${(homeProb * 100).toFixed(0)}% prob por win% (${(homeStats.win_pct * 100).toFixed(0)}% vs ${(awayStats.win_pct * 100).toFixed(0)}%)${form}`
        );
      } else if (homeProb < 0.40) {
        const awayProb = 1 - homeProb;
        const score = awayProb > 0.70 ? 0.20 : 0.14;
        const form = awayStats.recent_form ? ` (racha: ${awayStats.recent_form})` : '';
        addSignal(eventId, 'h2h', teams.away_team, 'draftkings', 0,
          'STATS', score,
          `Stats: ${teams.away_team} ${(awayProb * 100).toFixed(0)}% prob por win% (${(awayStats.win_pct * 100).toFixed(0)}% vs ${(homeStats.win_pct * 100).toFixed(0)}%)${form}`
        );
      }
    }
  }

  // ─── Signal 10: Weather (outdoor MLB games) ───
  for (const [eventId, weather] of input.weather) {
    if (!weather.is_outdoor) continue;
    const teams = input.eventTeams.get(eventId);
    if (!teams) continue;

    if (weather.impact === 'unfavorable') {
      // Bad weather = favor under on totals
      if (weather.wind_mph > 15 || weather.precipitation_chance > 40) {
        addSignal(eventId, 'totals', 'Under', 'draftkings', 0,
          'WEATHER', 0.12,
          `Clima desfavorable: ${weather.description}. Favorece Under.`
        );
      }
    }
  }

  // ─── Signal 11: Polymarket ───
  for (const poly of input.polymarket) {
    if (poly.yes_price <= 0) continue;
    const question = poly.question.toLowerCase();

    for (const [eventId, teams] of input.eventTeams) {
      const homeLC = teams.home_team.toLowerCase();
      const awayLC = teams.away_team.toLowerCase();
      const matchesHome = homeLC.split(' ').some((w) => w.length > 3 && question.includes(w));
      const matchesAway = awayLC.split(' ').some((w) => w.length > 3 && question.includes(w));

      if (matchesHome && poly.yes_price > 0.55) {
        const score = poly.yes_price > 0.70 ? 0.18 : 0.12;
        addSignal(eventId, 'h2h', teams.home_team, 'draftkings', 0,
          'POLYMARKET', score,
          `Polymarket: ${(poly.yes_price * 100).toFixed(0)}% probabilidad`
        );
      } else if (matchesAway && poly.yes_price > 0.55) {
        const score = poly.yes_price > 0.70 ? 0.18 : 0.12;
        addSignal(eventId, 'h2h', teams.away_team, 'draftkings', 0,
          'POLYMARKET', score,
          `Polymarket: ${(poly.yes_price * 100).toFixed(0)}% probabilidad`
        );
      }
    }
  }

  // ─── Signal 13: Back-to-back / Fatigue ───
  for (const f of input.fatigue) {
    if (f.advantage === 'fatigued') {
      // Opponent of fatigued team has advantage
      const teams = input.eventTeams.get(f.event_id);
      if (teams) {
        const opponent = f.team_name === teams.home_team ? teams.away_team : teams.home_team;
        addSignal(f.event_id, 'h2h', opponent, 'draftkings', 0,
          'FATIGUE', 0.14,
          `${f.team_name} en back-to-back. ${f.description}`
        );
      }
    } else if (f.advantage === 'rested') {
      addSignal(f.event_id, 'h2h', f.team_name, 'draftkings', 0,
        'REST', 0.10,
        `${f.team_name} descansado. ${f.description}`
      );
    }
  }

  // ─── Signal 14: Home/Away advantage ───
  for (const ha of input.homeAway) {
    if (ha.is_home && ha.home_advantage_pct > 0.55) {
      addSignal(ha.event_id, 'h2h', ha.team_name, 'draftkings', 0,
        'HOME', 0.08,
        ha.description
      );
    }
  }

  // ─── Signal 15: Pace of Play (NBA totals) ───
  for (const p of input.pace) {
    if (p.combined_pace === 'fast') {
      addSignal(p.event_id, 'totals', 'Over', 'draftkings', 0,
        'PACE', 0.16,
        p.description
      );
    } else if (p.combined_pace === 'slow') {
      addSignal(p.event_id, 'totals', 'Under', 'draftkings', 0,
        'PACE', 0.16,
        p.description
      );
    }
  }

  // ─── Signal 16: Altitude / Park Factor (MLB) ───
  for (const a of input.altitude) {
    if (a.park_factor > 1.1) {
      addSignal(a.event_id, 'totals', 'Over', 'draftkings', 0,
        'ALTITUDE', a.is_high_altitude ? 0.20 : 0.12,
        a.description
      );
    } else if (a.park_factor < 0.94) {
      addSignal(a.event_id, 'totals', 'Under', 'draftkings', 0,
        'ALTITUDE', 0.12,
        a.description
      );
    }
  }

  // ─── Signal 18: Closing Line Value ───
  for (const c of input.clv) {
    if (c.clv < -10) {
      // Line moved in our favor = sharp agreement
      addSignal(c.event_id, c.market_key, c.outcome_name, 'draftkings', 0,
        'CLV', 0.18,
        c.description
      );
    }
  }

  // ─── Signal 19: Streaks & Regression ───
  for (const s of input.streaks) {
    if (s.streak_type === 'cold' && s.regression_likely) {
      // Cold team due for regression = contrarian value
      addSignal(s.event_id, 'h2h', s.team_name, 'draftkings', 0,
        'REGRESSION', 0.12,
        `Regresion: ${s.description}`
      );
    } else if (s.streak_type === 'hot' && !s.regression_likely && s.streak_length >= 4) {
      addSignal(s.event_id, 'h2h', s.team_name, 'draftkings', 0,
        'STREAK', 0.10,
        `Racha: ${s.description}`
      );
    }
  }

  // ─── Signal 20: Playoff Implications ───
  for (const p of input.playoff) {
    if (p.motivation === 'high') {
      addSignal(p.event_id, 'h2h', p.team_name, 'draftkings', 0,
        'PLAYOFF', 0.14,
        p.description
      );
    } else if (p.motivation === 'low') {
      // Low motivation team = fade them
      const teams = input.eventTeams.get(p.event_id);
      if (teams) {
        const opponent = p.team_name === teams.home_team ? teams.away_team : teams.home_team;
        addSignal(p.event_id, 'h2h', opponent, 'draftkings', 0,
          'TANK', 0.12,
          `Oponente ${p.team_name} sin motivacion. ${p.description}`
        );
      }
    }
  }

  // ─── Score & Rank All Candidates (Optimized) ───
  const results: ScoredRecommendation[] = [];
  const now = Date.now();

  // Categorize signal types for weighting
  const MARKET_SIGNALS = new Set(['EV', 'ARB', 'DISCREPANCY', 'CLV', 'STEAM', 'LINE_MOVE']);
  const DATA_SIGNALS = new Set(['STATS', 'PACE', 'ALTITUDE', 'WEATHER', 'FATIGUE', 'REST', 'HOME', 'STREAK', 'REGRESSION', 'PLAYOFF', 'TANK']);
  const CROWD_SIGNALS = new Set(['EXPERT', 'ROBINHOOD', 'POLYMARKET', 'CONTRARIAN']);

  for (const [, c] of candidates) {
    // Count unique signal categories (market, data, crowd)
    const hasMarket = c.signals.some((s) => MARKET_SIGNALS.has(s));
    const hasData = c.signals.some((s) => DATA_SIGNALS.has(s));
    const hasCrowd = c.signals.some((s) => CROWD_SIGNALS.has(s));
    const categoryCount = (hasMarket ? 1 : 0) + (hasData ? 1 : 0) + (hasCrowd ? 1 : 0);

    // Weighted average of signal scores (higher scores weight more)
    const sorted = [...c.scores].sort((a, b) => b - a);
    const weightedSum = sorted.reduce((s, v, i) => s + v * (1 / (i + 1)), 0);
    const weightTotal = sorted.reduce((s, _, i) => s + 1 / (i + 1), 0);
    const weightedAvg = weightedSum / weightTotal;

    // Correlation multiplier: diversity of signal categories matters most
    // 1 category = 1x, 2 categories = 1.5x, 3 categories = 2.2x
    const diversityBonus = categoryCount === 3 ? 2.2 : categoryCount === 2 ? 1.5 : 1.0;

    // Volume bonus: more total signals = slightly safer
    const volumeBonus = Math.min(1.5, 1 + (c.signals.length - 1) * 0.1);

    // Final confidence
    const confidence = Math.min(0.98, weightedAvg * diversityBonus * volumeBonus);

    // Skip low confidence
    if (confidence < 0.12) continue;

    // Determine type
    let type = 'value';
    if (c.signals.includes('ARB')) type = 'arbitrage';
    else if (c.signals.includes('EV') && c.signals.length >= 2) type = 'ev';
    else if (c.signals.includes('STEAM')) type = 'steam';
    else if (c.signals.includes('EXPERT') && c.signals.length >= 2) type = 'expert';

    // Build reasoning with safety label
    const uniqueSignals = [...new Set(c.signals)];
    const signalSummary = uniqueSignals.join(' + ');
    const safetyLabel = categoryCount === 3 && c.signals.length >= 4
      ? '🔒 MAS SEGURA | '
      : categoryCount >= 2 && c.signals.length >= 3
        ? '✅ SEGURA | '
        : '';
    const reasoning = `${safetyLabel}[${signalSummary}] (${categoryCount}/3 categorias, ${c.signals.length} senales) ${c.reasonParts.slice(0, 4).join('. ')}.`;

    results.push({
      event_id: c.event_id,
      type,
      market_key: c.market_key,
      outcome_name: c.outcome_name,
      bookmaker_key: c.bookmaker_key,
      odds: c.odds,
      reasoning,
      confidence_score: Math.round(confidence * 100) / 100,
      valid_until: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
      signals: uniqueSignals,
      signal_count: c.signals.length,
    });
  }

  // Sort by: category diversity DESC, signal_count DESC, confidence DESC
  results.sort((a, b) => {
    if (b.signal_count !== a.signal_count) return b.signal_count - a.signal_count;
    return b.confidence_score - a.confidence_score;
  });

  return results;
}
