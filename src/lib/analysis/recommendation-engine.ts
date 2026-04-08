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

  // ─── Score & Rank All Candidates ───
  const results: ScoredRecommendation[] = [];
  const now = Date.now();

  for (const [, c] of candidates) {
    // Base confidence = average of signal scores
    const avgScore = c.scores.reduce((a, b) => a + b, 0) / c.scores.length;

    // Correlation bonus: more signals = exponentially safer
    // 1 signal = 1x, 2 signals = 1.4x, 3 signals = 1.8x, 4+ = 2.0x
    const correlationMultiplier = Math.min(2.0, 1 + (c.signals.length - 1) * 0.3);

    // Final confidence
    const confidence = Math.min(0.98, avgScore * correlationMultiplier);

    // Skip low confidence
    if (confidence < 0.15) continue;

    // Determine type
    let type = 'value';
    if (c.signals.includes('ARB')) type = 'arbitrage';
    else if (c.signals.includes('EV') && c.signals.length >= 2) type = 'ev';
    else if (c.signals.includes('STEAM')) type = 'steam';
    else if (c.signals.includes('EXPERT') && c.signals.length >= 2) type = 'expert';

    // Build reasoning
    const signalSummary = c.signals.join(' + ');
    const reasoning = `[${signalSummary}] ${c.reasonParts.join('. ')}.`;

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
      signals: c.signals,
      signal_count: c.signals.length,
    });
  }

  // Sort by: signal_count DESC, then confidence DESC
  results.sort((a, b) => {
    if (b.signal_count !== a.signal_count) return b.signal_count - a.signal_count;
    return b.confidence_score - a.confidence_score;
  });

  return results;
}
