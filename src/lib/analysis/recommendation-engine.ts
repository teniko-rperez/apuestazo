/**
 * Unified Recommendation Engine
 *
 * Combines ALL available signals to produce weighted, ranked recommendations:
 * - Arbitrage opportunities (guaranteed profit)
 * - +EV edges (positive expected value)
 * - Expert picks (Covers.com + Reddit consensus)
 * - Line movement / steam moves (sharp money signals)
 * - Consensus public betting percentages (fade-the-public)
 * - Odds discrepancies across bookmakers
 * - Parlay builder (correlated +EV legs)
 *
 * Each signal contributes a score weighted by reliability.
 * Final confidence = weighted average clamped to [0, 1].
 */

import { formatOdds, formatPct } from './implied-probability';
import type { ArbResult } from './arbitrage';
import type { EvResult } from './expected-value';
import type { SteamMove, LineMovement } from './line-movement';
import type { ParlayCombo } from './parlay-builder';
import type { ExpertPick } from '@/lib/scrapers/experts';
import { BOOKMAKERS, MARKET_LABELS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Signal {
  name: string;
  weight: number;
  score: number; // 0-1
  detail: string;
}

export interface EngineRecommendation {
  event_id: string;
  type: 'arbitrage' | 'ev' | 'value' | 'parlay_leg' | 'expert' | 'steam';
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  reasoning: string;
  confidence_score: number;
  signals: Signal[];
  valid_until: string;
}

interface ConsensusEntry {
  event_name: string;
  home_team: string;
  away_team: string;
  home_spread_pct: number;
  away_spread_pct: number;
  over_pct: number;
  under_pct: number;
}

interface OddsDiscrepancy {
  event_id: string;
  market_key: string;
  outcome_name: string;
  max_odds: number;
  min_odds: number;
  max_bookmaker: string;
  min_bookmaker: string;
  discrepancy: number;
}

// Map event_id -> { home_team, away_team }
interface EventTeams {
  home_team: string;
  away_team: string;
}

// ---------------------------------------------------------------------------
// Signal weights (total doesn't need to be 1; we normalize later)
// ---------------------------------------------------------------------------
const WEIGHTS = {
  arbitrage: 0.30,   // Highest — guaranteed profit
  ev: 0.25,          // Strong — mathematical edge
  expert: 0.15,      // Moderate — expert consensus
  steam: 0.12,       // Moderate — sharp money indicator
  discrepancy: 0.10, // Supporting — bookmaker disagreement
  consensus: 0.08,   // Light — fade-the-public contrarian signal
} as const;

// ---------------------------------------------------------------------------
// Input bundle for the engine
// ---------------------------------------------------------------------------
export interface EngineInput {
  arbs: ArbResult[];
  evs: EvResult[];
  expertPicks: ExpertPick[];
  lineMovements: LineMovement[];
  steamMoves: SteamMove[];
  consensus: ConsensusEntry[];
  discrepancies: OddsDiscrepancy[];
  parlays: ParlayCombo[];
  eventTeams: Map<string, EventTeams>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bookName(key: string): string {
  return BOOKMAKERS[key]?.name ?? key;
}

function marketLabel(key: string): string {
  return MARKET_LABELS[key] ?? key;
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Try to match an expert pick to a specific outcome */
function expertMatchesOutcome(
  pick: ExpertPick,
  outcomeName: string,
  eventTeams?: EventTeams
): boolean {
  if (!eventTeams) return false;
  const desc = pick.pick_description.toLowerCase();
  const outcome = outcomeName.toLowerCase();

  // Direct team name match
  if (desc.includes(outcome)) return true;

  // Partial match (last word of team name, e.g. "Lakers" in "Los Angeles Lakers")
  const lastWord = outcome.split(' ').pop() ?? '';
  if (lastWord.length > 3 && desc.includes(lastWord)) return true;

  // Over/Under match
  if (
    (outcome === 'over' && desc.includes('over')) ||
    (outcome === 'under' && desc.includes('under'))
  ) {
    return true;
  }

  return false;
}

/** Get consensus percentage that favors an outcome (for fade-the-public) */
function getConsensusPct(
  consensus: ConsensusEntry[],
  eventTeams: EventTeams | undefined,
  outcomeName: string,
  marketKey: string
): number | null {
  if (!eventTeams || consensus.length === 0) return null;

  const entry = consensus.find(
    (c) =>
      c.home_team === eventTeams.home_team ||
      c.away_team === eventTeams.away_team
  );
  if (!entry) return null;

  if (marketKey === 'h2h' || marketKey === 'spreads') {
    if (outcomeName === eventTeams.home_team) return entry.home_spread_pct;
    if (outcomeName === eventTeams.away_team) return entry.away_spread_pct;
  }

  if (marketKey === 'totals') {
    if (outcomeName === 'Over') return entry.over_pct;
    if (outcomeName === 'Under') return entry.under_pct;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function generateRecommendations(input: EngineInput): EngineRecommendation[] {
  const {
    arbs,
    evs,
    expertPicks,
    lineMovements,
    steamMoves,
    consensus,
    discrepancies,
    parlays,
    eventTeams,
  } = input;

  const recommendations: EngineRecommendation[] = [];
  const now = Date.now();

  // Index helpers for quick lookup
  const steamByKey = new Map<string, SteamMove>();
  for (const s of steamMoves) {
    steamByKey.set(`${s.event_id}|${s.market_key}|${s.outcome_name}`, s);
  }

  const movementsByKey = new Map<string, LineMovement[]>();
  for (const m of lineMovements) {
    const key = `${m.event_id}|${m.market_key}|${m.outcome_name}`;
    const list = movementsByKey.get(key) ?? [];
    list.push(m);
    movementsByKey.set(key, list);
  }

  const discrepancyByKey = new Map<string, OddsDiscrepancy>();
  for (const d of discrepancies) {
    discrepancyByKey.set(`${d.event_id}|${d.market_key}|${d.outcome_name}`, d);
  }

  // Expert picks indexed by sport
  const expertsBySport = new Map<string, ExpertPick[]>();
  for (const ep of expertPicks) {
    const list = expertsBySport.get(ep.sport) ?? [];
    list.push(ep);
    expertsBySport.set(ep.sport, list);
  }

  // ----- 1. Arbitrage-based recommendations (highest priority) -----
  for (const arb of arbs.slice(0, 5)) {
    for (const leg of arb.legs) {
      const signals: Signal[] = [];

      // Arbitrage signal
      const arbScore = clamp(0.85 + arb.profit_margin * 5);
      signals.push({
        name: 'Arbitraje',
        weight: WEIGHTS.arbitrage,
        score: arbScore,
        detail: `${formatPct(arb.profit_margin)} ganancia garantizada`,
      });

      // Check if steam supports it
      const steamKey = `${arb.event_id}|${arb.market_key}|${leg.outcome_name}`;
      const steam = steamByKey.get(steamKey);
      if (steam && steam.direction === 'up') {
        signals.push({
          name: 'Steam Move',
          weight: WEIGHTS.steam,
          score: 0.8,
          detail: `${steam.bookmakers_moving.length} casas moviendo a favor`,
        });
      }

      const confidence = computeConfidence(signals);

      recommendations.push({
        event_id: arb.event_id,
        type: 'arbitrage',
        market_key: arb.market_key,
        outcome_name: leg.outcome_name,
        bookmaker_key: leg.bookmaker,
        odds: leg.odds,
        reasoning: buildReasoning(signals, `Arbitraje en ${marketLabel(arb.market_key)}`),
        confidence_score: confidence,
        signals,
        valid_until: new Date(now + 60 * 60 * 1000).toISOString(), // 1h
      });
    }
  }

  // ----- 2. +EV recommendations enriched with all signals -----
  for (const ev of evs.slice(0, 15)) {
    const signals: Signal[] = [];
    const teams = eventTeams.get(ev.event_id);

    // EV signal
    const evScore = clamp(0.5 + ev.edge_pct * 5);
    signals.push({
      name: '+EV',
      weight: WEIGHTS.ev,
      score: evScore,
      detail: `${formatPct(ev.edge_pct)} ventaja. Odds ${formatOdds(ev.odds)} vs justas ${formatOdds(ev.fair_odds)}`,
    });

    // Expert alignment
    const sportKey = teams ? guessEventSport(ev.event_id, eventTeams) : null;
    if (sportKey) {
      const relevantExperts = expertsBySport.get(sportKey) ?? [];
      const matching = relevantExperts.filter((ep) =>
        expertMatchesOutcome(ep, ev.outcome_name, teams)
      );
      if (matching.length > 0) {
        const highConfCount = matching.filter((e) => e.confidence === 'alta').length;
        const expertScore = clamp(0.4 + matching.length * 0.15 + highConfCount * 0.1);
        signals.push({
          name: 'Expertos',
          weight: WEIGHTS.expert,
          score: expertScore,
          detail: `${matching.length} experto(s) alineados${highConfCount > 0 ? `, ${highConfCount} con confianza alta` : ''}`,
        });
      }
    }

    // Steam signal
    const steamKey = `${ev.event_id}|${ev.market_key}|${ev.outcome_name}`;
    const steam = steamByKey.get(steamKey);
    if (steam) {
      const steamDirection = steam.direction === 'up' ? 'subiendo' : 'bajando';
      signals.push({
        name: 'Steam Move',
        weight: WEIGHTS.steam,
        score: 0.75,
        detail: `Línea ${steamDirection} en ${steam.bookmakers_moving.length} casas (dinero sharp)`,
      });
    }

    // Line movement signal (even without steam)
    const movements = movementsByKey.get(steamKey);
    if (!steam && movements && movements.length > 0) {
      const significant = movements.filter((m) => m.is_significant);
      if (significant.length > 0) {
        signals.push({
          name: 'Movimiento',
          weight: WEIGHTS.steam * 0.5,
          score: 0.6,
          detail: `Movimiento significativo en ${significant.length} casa(s)`,
        });
      }
    }

    // Discrepancy signal
    const disc = discrepancyByKey.get(steamKey);
    if (disc) {
      const discScore = clamp(0.4 + disc.discrepancy / 100);
      signals.push({
        name: 'Discrepancia',
        weight: WEIGHTS.discrepancy,
        score: discScore,
        detail: `${disc.discrepancy} cents entre ${bookName(disc.max_bookmaker)} y ${bookName(disc.min_bookmaker)}`,
      });
    }

    // Consensus (fade-the-public)
    const publicPct = getConsensusPct(consensus, teams, ev.outcome_name, ev.market_key);
    if (publicPct !== null && publicPct < 40) {
      // Under 40% public support = contrarian play
      const contrarianScore = clamp(0.5 + (40 - publicPct) / 50);
      signals.push({
        name: 'Contrarian',
        weight: WEIGHTS.consensus,
        score: contrarianScore,
        detail: `Solo ${publicPct.toFixed(0)}% del público apoya esto — señal contrarian`,
      });
    }

    const confidence = computeConfidence(signals);

    recommendations.push({
      event_id: ev.event_id,
      type: signals.length >= 3 ? 'value' : 'ev',
      market_key: ev.market_key,
      outcome_name: ev.outcome_name,
      bookmaker_key: ev.bookmaker_key,
      odds: ev.odds,
      reasoning: buildReasoning(
        signals,
        `${marketLabel(ev.market_key)}: ${ev.outcome_name} en ${bookName(ev.bookmaker_key)}`
      ),
      confidence_score: confidence,
      signals,
      valid_until: new Date(now + 2 * 60 * 60 * 1000).toISOString(), // 2h
    });
  }

  // ----- 3. Steam-only recommendations (sharp money, no EV match) -----
  const evKeys = new Set(
    evs.map((e) => `${e.event_id}|${e.market_key}|${e.outcome_name}`)
  );
  for (const steam of steamMoves) {
    const key = `${steam.event_id}|${steam.market_key}|${steam.outcome_name}`;
    if (evKeys.has(key)) continue; // already covered by EV

    const signals: Signal[] = [];

    signals.push({
      name: 'Steam Move',
      weight: WEIGHTS.steam,
      score: 0.7,
      detail: `${steam.bookmakers_moving.length} casas moviendo ${steam.direction === 'up' ? 'al alza' : 'a la baja'} (avg ${steam.average_change > 0 ? '+' : ''}${steam.average_change.toFixed(0)} cents)`,
    });

    // Check expert alignment
    const teams = eventTeams.get(steam.event_id);
    const sportKey = teams ? guessEventSport(steam.event_id, eventTeams) : null;
    if (sportKey) {
      const relevantExperts = expertsBySport.get(sportKey) ?? [];
      const matching = relevantExperts.filter((ep) =>
        expertMatchesOutcome(ep, steam.outcome_name, teams)
      );
      if (matching.length > 0) {
        signals.push({
          name: 'Expertos',
          weight: WEIGHTS.expert,
          score: 0.6,
          detail: `${matching.length} experto(s) alineados con el movimiento`,
        });
      }
    }

    const disc = discrepancyByKey.get(key);
    if (disc) {
      signals.push({
        name: 'Discrepancia',
        weight: WEIGHTS.discrepancy,
        score: clamp(0.4 + disc.discrepancy / 100),
        detail: `${disc.discrepancy} cents de diferencia entre casas`,
      });
    }

    const confidence = computeConfidence(signals);
    if (confidence < 0.45) continue; // Skip weak steam-only signals

    // Use best bookmaker from the line movement data
    const movements = movementsByKey.get(key) ?? [];
    const bestMove = movements.sort((a, b) => b.current_odds - a.current_odds)[0];

    recommendations.push({
      event_id: steam.event_id,
      type: 'steam',
      market_key: steam.market_key,
      outcome_name: steam.outcome_name,
      bookmaker_key: bestMove?.bookmaker_key ?? steam.bookmakers_moving[0],
      odds: bestMove?.current_odds ?? 0,
      reasoning: buildReasoning(
        signals,
        `Steam en ${marketLabel(steam.market_key)}: ${steam.outcome_name}`
      ),
      confidence_score: confidence,
      signals,
      valid_until: new Date(now + 90 * 60 * 1000).toISOString(), // 1.5h
    });
  }

  // ----- 4. Expert-only recommendations (strong consensus, no EV/arb match) -----
  const coveredOutcomes = new Set(
    recommendations.map((r) => `${r.event_id}|${r.outcome_name}`)
  );
  // Group expert picks by description similarity to find consensus
  const expertGroups = new Map<string, ExpertPick[]>();
  for (const ep of expertPicks) {
    // Normalize pick for grouping
    const normalized = ep.pick_description.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const groupKey = `${ep.sport}|${normalized}`;
    const group = expertGroups.get(groupKey) ?? [];
    group.push(ep);
    expertGroups.set(groupKey, group);
  }

  for (const [, group] of expertGroups) {
    if (group.length < 2) continue; // Need at least 2 experts agreeing

    const highConf = group.filter((e) => e.confidence === 'alta');
    if (highConf.length === 0 && group.length < 3) continue;

    const signals: Signal[] = [];
    const expertScore = clamp(0.5 + group.length * 0.12 + highConf.length * 0.1);
    signals.push({
      name: 'Consenso Expertos',
      weight: WEIGHTS.expert * 1.5, // Boost weight for multi-expert consensus
      score: expertScore,
      detail: `${group.length} experto(s) coinciden${highConf.length > 0 ? `, ${highConf.length} alta confianza` : ''}`,
    });

    const confidence = computeConfidence(signals);
    if (confidence < 0.5) continue;

    const rep = group[0];
    recommendations.push({
      event_id: '', // no direct event match
      type: 'expert',
      market_key: rep.pick_type === 'moneyline' ? 'h2h' : rep.pick_type === 'total' ? 'totals' : 'spreads',
      outcome_name: rep.pick_description,
      bookmaker_key: '',
      odds: 0,
      reasoning: buildReasoning(
        signals,
        `Consenso expertos (${rep.source}): ${rep.pick_description}`
      ),
      confidence_score: confidence,
      signals,
      valid_until: new Date(now + 3 * 60 * 60 * 1000).toISOString(), // 3h
    });
  }

  // ----- 5. Parlay recommendations -----
  for (const parlay of parlays.slice(0, 3)) {
    for (const leg of parlay.legs) {
      // Check if this leg is already recommended individually
      const existing = recommendations.find(
        (r) =>
          r.event_id === leg.event_id &&
          r.outcome_name === leg.outcome_name &&
          r.market_key === leg.market_key
      );

      const signals: Signal[] = [];
      signals.push({
        name: 'Parlay +EV',
        weight: WEIGHTS.ev * 0.8,
        score: clamp(0.5 + parlay.combined_edge * 3),
        detail: `Odds combinadas +${parlay.combined_odds}. Ventaja: ${formatPct(parlay.combined_edge)}`,
      });

      if (existing && existing.confidence_score > 0.6) {
        signals.push({
          name: 'Multi-señal',
          weight: 0.1,
          score: existing.confidence_score,
          detail: `También recomendado individualmente (${formatPct(existing.confidence_score)} confianza)`,
        });
      }

      const confidence = computeConfidence(signals);

      recommendations.push({
        event_id: leg.event_id,
        type: 'parlay_leg',
        market_key: leg.market_key,
        outcome_name: leg.outcome_name,
        bookmaker_key: leg.bookmaker_key,
        odds: leg.odds,
        reasoning: buildReasoning(
          signals,
          `Pierna parlay en ${bookName(leg.bookmaker_key)}`
        ),
        confidence_score: confidence,
        signals,
        valid_until: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  // ----- Final: sort by confidence, deduplicate, return top results -----
  return deduplicateAndRank(recommendations);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function computeConfidence(signals: Signal[]): number {
  if (signals.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const s of signals) {
    weightedSum += s.weight * s.score;
    totalWeight += s.weight;
  }

  let base = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Multi-signal bonus: having more confirming signals increases confidence
  const signalCount = signals.length;
  if (signalCount >= 4) base = Math.min(1, base * 1.15);
  else if (signalCount >= 3) base = Math.min(1, base * 1.10);
  else if (signalCount >= 2) base = Math.min(1, base * 1.05);

  return clamp(base);
}

// ---------------------------------------------------------------------------
// Reasoning builder
// ---------------------------------------------------------------------------

function buildReasoning(signals: Signal[], prefix: string): string {
  const parts = signals.map((s) => `${s.name}: ${s.detail}`);
  return `${prefix}. ${parts.join(' | ')}`;
}

// ---------------------------------------------------------------------------
// Deduplication & ranking
// ---------------------------------------------------------------------------

function deduplicateAndRank(recs: EngineRecommendation[]): EngineRecommendation[] {
  // Keep highest-confidence entry per event+market+outcome
  const best = new Map<string, EngineRecommendation>();

  for (const rec of recs) {
    const key = `${rec.event_id}|${rec.market_key}|${rec.outcome_name}`;
    const existing = best.get(key);

    if (!existing) {
      best.set(key, rec);
    } else if (rec.confidence_score > existing.confidence_score) {
      // Merge signals from both
      const mergedSignals = mergeSignals(existing.signals, rec.signals);
      rec.signals = mergedSignals;
      rec.confidence_score = computeConfidence(mergedSignals);
      rec.reasoning = buildReasoning(
        mergedSignals,
        rec.reasoning.split('.')[0]
      );
      best.set(key, rec);
    } else {
      // Merge signals into existing
      existing.signals = mergeSignals(existing.signals, rec.signals);
      existing.confidence_score = computeConfidence(existing.signals);
      existing.reasoning = buildReasoning(
        existing.signals,
        existing.reasoning.split('.')[0]
      );
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 25);
}

function mergeSignals(a: Signal[], b: Signal[]): Signal[] {
  const byName = new Map<string, Signal>();
  for (const s of a) byName.set(s.name, s);
  for (const s of b) {
    const existing = byName.get(s.name);
    if (!existing || s.score > existing.score) {
      byName.set(s.name, s);
    }
  }
  return Array.from(byName.values());
}

// ---------------------------------------------------------------------------
// Utility: guess sport from event_id pattern or eventTeams map
// ---------------------------------------------------------------------------
function guessEventSport(
  eventId: string,
  eventTeamsMap: Map<string, EventTeams>
): string | null {
  // ESPN IDs for NBA typically have certain patterns, but we can't
  // rely on that. Instead, check if the event ID is in our map and
  // use the team names to guess sport.
  // For now we return null and let the caller handle it.
  // In the cron route, we pass sport info alongside eventTeams.
  // This is a best-effort lookup.
  if (eventId.startsWith('401')) return 'nba'; // ESPN NBA IDs often start with 401
  return 'mlb'; // default fallback
}
