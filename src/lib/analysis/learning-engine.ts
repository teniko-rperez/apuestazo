/**
 * Self-Learning Engine v2.
 * Analyzes EVERY loss in detail, finds patterns, and aggressively
 * adjusts thresholds until win rate approaches maximum.
 *
 * Strategy: Be very selective. Better to skip a bet than lose one.
 * Target: 70%+ win rate by only betting on highest-confidence picks.
 */

export interface LossAnalysis {
  bet_id: number;
  outcome_name: string;
  odds: number;
  signals_used: string[];
  signal_count: number;
  category_count: number;
  confidence: number;
  was_favorite: boolean;
  was_home: boolean;
  loss_reason: string; // computed analysis of why it lost
}

export interface LearnedConfig {
  signal_weights: Record<string, number>;
  min_confidence: number;
  min_signals: number;
  min_categories: number;
  max_odds: number; // don't bet on extreme underdogs
  min_odds: number; // don't bet on heavy favorites (low payout)
  avoid_signals: string[]; // signals that historically lose
  best_combos: string[];
  worst_combos: string[];
  total_bets_analyzed: number;
  overall_win_rate: number;
  loss_analysis: LossAnalysis[];
  adjustments_made: string[];
  last_learned: string;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  EV: 0.30, ARB: 0.25, STEAM: 0.20, LINE_MOVE: 0.10,
  EXPERT: 0.18, DISCREPANCY: 0.12, CONTRARIAN: 0.10,
  ROBINHOOD: 0.16, POLYMARKET: 0.14, STATS: 0.16,
  WEATHER: 0.12, ALTITUDE: 0.14, PACE: 0.16,
  FATIGUE: 0.14, REST: 0.10, HOME: 0.08,
  CLV: 0.18, STREAK: 0.10, REGRESSION: 0.12,
  PLAYOFF: 0.14, TANK: 0.12,
};

interface BetData {
  result: 'won' | 'lost' | 'push';
  profit: number;
  reasoning: string;
  odds?: number;
  outcome_name?: string;
  home_team?: string;
}

/**
 * Deep analysis of every loss to find patterns.
 */
function analyzeLosses(bets: BetData[]): { analysis: LossAnalysis[]; patterns: string[] } {
  const losses = bets.filter((b) => b.result === 'lost');
  const analysis: LossAnalysis[] = [];
  const patterns: string[] = [];

  // Track loss patterns
  let underdogLosses = 0;
  let favoriteLosses = 0;
  let lowSignalLosses = 0;
  let singleCatLosses = 0;
  const signalLossCounts: Record<string, number> = {};

  for (const bet of losses) {
    const signalMatch = bet.reasoning?.match(/\[([^\]]+)\]/);
    const signals = signalMatch ? signalMatch[1].split('+').map((s) => s.trim()) : [];
    const catMatch = bet.reasoning?.match(/(\d)\/3 categorias, (\d+) senales/);
    const catCount = catMatch ? parseInt(catMatch[1]) : 1;
    const signalCount = catMatch ? parseInt(catMatch[2]) : signals.length;

    const odds = bet.odds ?? 0;
    const isFavorite = odds < 0;
    const isUnderdog = odds > 0;
    const isHome = bet.outcome_name === bet.home_team;

    if (isUnderdog) underdogLosses++;
    if (isFavorite) favoriteLosses++;
    if (signalCount <= 2) lowSignalLosses++;
    if (catCount <= 1) singleCatLosses++;

    for (const sig of signals) {
      signalLossCounts[sig] = (signalLossCounts[sig] ?? 0) + 1;
    }

    // Determine likely loss reason
    let reason = '';
    if (isUnderdog && odds > 300) reason = 'Apuesta en underdog grande (+300+). Riesgo alto.';
    else if (signalCount <= 2) reason = `Solo ${signalCount} senales. Insuficiente correlacion.`;
    else if (catCount <= 1) reason = `Solo ${catCount} categoria de senales. Falta diversidad.`;
    else if (isFavorite && odds < -300) reason = 'Favorito extremo pero el pago no justifica el riesgo.';
    else reason = 'Resultado inesperado. Varianza normal del deporte.';

    analysis.push({
      bet_id: 0,
      outcome_name: bet.outcome_name ?? '',
      odds,
      signals_used: signals,
      signal_count: signalCount,
      category_count: catCount,
      confidence: 0,
      was_favorite: isFavorite,
      was_home: isHome,
      loss_reason: reason,
    });
  }

  // Identify patterns
  const totalLosses = losses.length;
  if (totalLosses >= 2) {
    if (underdogLosses / totalLosses > 0.5) patterns.push(`${underdogLosses}/${totalLosses} perdidas fueron underdogs. Evitar underdogs grandes.`);
    if (lowSignalLosses / totalLosses > 0.4) patterns.push(`${lowSignalLosses}/${totalLosses} perdidas tenian 2 o menos senales. Subir minimo.`);
    if (singleCatLosses / totalLosses > 0.4) patterns.push(`${singleCatLosses}/${totalLosses} perdidas tenian 1 sola categoria. Subir minimo.`);

    // Find signals that appear in losses more than wins
    for (const [sig, count] of Object.entries(signalLossCounts)) {
      if (count >= 2) patterns.push(`Senal ${sig} aparecio en ${count} perdidas.`);
    }
  }

  return { analysis, patterns };
}

/**
 * Main learning function. Analyzes all history and returns optimized config.
 */
export function learnFromHistory(bets: BetData[]): LearnedConfig {
  const adjustments: string[] = [];
  const learnedWeights = { ...DEFAULT_WEIGHTS };

  if (bets.length < 3) {
    return {
      signal_weights: learnedWeights,
      min_confidence: 0.15,
      min_signals: 2,
      min_categories: 1,
      max_odds: 500,
      min_odds: -800,
      avoid_signals: [],
      best_combos: [],
      worst_combos: [],
      total_bets_analyzed: bets.length,
      overall_win_rate: 0,
      loss_analysis: [],
      adjustments_made: ['Datos insuficientes. Usando defaults conservadores.'],
      last_learned: new Date().toISOString(),
    };
  }

  const wins = bets.filter((b) => b.result === 'won');
  const losses = bets.filter((b) => b.result === 'lost');
  const winRate = wins.length / (wins.length + losses.length);

  // ─── Deep loss analysis ───
  const { analysis: lossAnalysis, patterns } = analyzeLosses(bets);
  for (const p of patterns) adjustments.push(`PATRON: ${p}`);

  // ─── Adjust signal weights based on win/loss per signal ───
  const signalWins: Record<string, number> = {};
  const signalLosses: Record<string, number> = {};

  for (const bet of bets) {
    if (bet.result === 'push') continue;
    const signals = bet.reasoning?.match(/\[([^\]]+)\]/)?.[1]?.split('+').map((s) => s.trim()) ?? [];
    for (const sig of signals) {
      if (bet.result === 'won') signalWins[sig] = (signalWins[sig] ?? 0) + 1;
      else signalLosses[sig] = (signalLosses[sig] ?? 0) + 1;
    }
  }

  const avoidSignals: string[] = [];
  for (const sig of Object.keys({ ...signalWins, ...signalLosses })) {
    const w = signalWins[sig] ?? 0;
    const l = signalLosses[sig] ?? 0;
    const total = w + l;
    if (total < 2) continue;
    const sigWR = w / total;
    const original = DEFAULT_WEIGHTS[sig] ?? 0.12;

    if (sigWR >= 0.75) {
      learnedWeights[sig] = Math.min(0.40, original * 1.6);
      adjustments.push(`${sig}: peso SUBIDO a ${(learnedWeights[sig] * 100).toFixed(0)}% (${w}W-${l}L = ${(sigWR * 100).toFixed(0)}% WR)`);
    } else if (sigWR >= 0.55) {
      learnedWeights[sig] = Math.min(0.35, original * 1.2);
    } else if (sigWR <= 0.30 && total >= 3) {
      learnedWeights[sig] = Math.max(0.03, original * 0.3);
      avoidSignals.push(sig);
      adjustments.push(`${sig}: peso REDUCIDO a ${(learnedWeights[sig] * 100).toFixed(0)}% (${w}W-${l}L = ${(sigWR * 100).toFixed(0)}% WR). EVITAR.`);
    } else if (sigWR < 0.45) {
      learnedWeights[sig] = Math.max(0.05, original * 0.6);
      adjustments.push(`${sig}: peso reducido a ${(learnedWeights[sig] * 100).toFixed(0)}% (${w}W-${l}L = ${(sigWR * 100).toFixed(0)}% WR)`);
    }
  }

  // ─── Determine optimal thresholds ───
  // Aggressively raise minimums if win rate is low
  let minConf = 0.15;
  let minSignals = 2;
  let minCats = 1;
  let maxOdds = 500;  // Don't bet on +500 underdogs
  let minOdds = -800; // Don't bet on -800 favorites

  if (winRate < 0.40) {
    // Very bad performance - be extremely selective
    minConf = 0.35;
    minSignals = 4;
    minCats = 2;
    maxOdds = 200;
    minOdds = -400;
    adjustments.push(`WIN RATE CRITICO (${(winRate * 100).toFixed(0)}%). Umbrales MAXIMOS: conf>35%, 4+ senales, 2+ categorias, odds entre -400 y +200.`);
  } else if (winRate < 0.55) {
    minConf = 0.25;
    minSignals = 3;
    minCats = 2;
    maxOdds = 300;
    minOdds = -500;
    adjustments.push(`WIN RATE BAJO (${(winRate * 100).toFixed(0)}%). Umbrales subidos: conf>25%, 3+ senales, 2+ categorias.`);
  } else if (winRate < 0.65) {
    minConf = 0.20;
    minSignals = 2;
    minCats = 1;
    maxOdds = 400;
    adjustments.push(`WIN RATE ACEPTABLE (${(winRate * 100).toFixed(0)}%). Umbrales moderados.`);
  } else {
    adjustments.push(`WIN RATE BUENO (${(winRate * 100).toFixed(0)}%). Manteniendo umbrales actuales.`);
  }

  // Check if underdog losses are a pattern
  const underdogLosses = lossAnalysis.filter((l) => !l.was_favorite).length;
  if (underdogLosses >= 2 && underdogLosses / lossAnalysis.length > 0.5) {
    maxOdds = Math.min(maxOdds, 200);
    adjustments.push(`PATRON UNDERDOG: ${underdogLosses} perdidas en underdogs. Limitando a max +${maxOdds}.`);
  }

  // ─── Find best/worst combos ───
  const comboWins: Record<string, number> = {};
  const comboLosses: Record<string, number> = {};
  for (const bet of bets) {
    if (bet.result === 'push') continue;
    const signals = bet.reasoning?.match(/\[([^\]]+)\]/)?.[1]?.split('+').map((s) => s.trim()).sort().join('+') ?? '';
    if (!signals) continue;
    if (bet.result === 'won') comboWins[signals] = (comboWins[signals] ?? 0) + 1;
    else comboLosses[signals] = (comboLosses[signals] ?? 0) + 1;
  }

  const bestCombos: string[] = [];
  const worstCombos: string[] = [];
  for (const combo of Object.keys({ ...comboWins, ...comboLosses })) {
    const w = comboWins[combo] ?? 0;
    const l = comboLosses[combo] ?? 0;
    if (w + l < 2) continue;
    if (w / (w + l) >= 0.70) bestCombos.push(combo);
    if (l / (w + l) >= 0.65) worstCombos.push(combo);
  }

  return {
    signal_weights: learnedWeights,
    min_confidence: minConf,
    min_signals: minSignals,
    min_categories: minCats,
    max_odds: maxOdds,
    min_odds: minOdds,
    avoid_signals: avoidSignals,
    best_combos: bestCombos.slice(0, 5),
    worst_combos: worstCombos.slice(0, 5),
    total_bets_analyzed: bets.length,
    overall_win_rate: winRate,
    loss_analysis: lossAnalysis,
    adjustments_made: adjustments,
    last_learned: new Date().toISOString(),
  };
}

/**
 * Should this bet be cancelled based on learned thresholds?
 */
export function shouldCancelBet(
  reasoning: string,
  confidence: number,
  config: LearnedConfig,
  odds?: number
): { cancel: boolean; reason: string } {
  if (confidence < config.min_confidence) {
    return { cancel: true, reason: `Confianza ${(confidence * 100).toFixed(0)}% < minimo ${(config.min_confidence * 100).toFixed(0)}%` };
  }

  const signalMatch = reasoning?.match(/\[([^\]]+)\]/);
  const signals = signalMatch ? signalMatch[1].split('+').map((s) => s.trim()) : [];
  const catMatch = reasoning?.match(/(\d)\/3 categorias, (\d+) senales/);
  const signalCount = catMatch ? parseInt(catMatch[2]) : signals.length;
  const catCount = catMatch ? parseInt(catMatch[1]) : 1;

  if (signalCount < config.min_signals) {
    return { cancel: true, reason: `${signalCount} senales < minimo ${config.min_signals}` };
  }
  if (catCount < config.min_categories) {
    return { cancel: true, reason: `${catCount} categorias < minimo ${config.min_categories}` };
  }

  // Check odds range
  if (odds != null) {
    if (odds > 0 && odds > config.max_odds) {
      return { cancel: true, reason: `Odds +${odds} > max +${config.max_odds} (underdog muy grande)` };
    }
    if (odds < 0 && odds < config.min_odds) {
      return { cancel: true, reason: `Odds ${odds} < min ${config.min_odds} (favorito extremo, payout muy bajo)` };
    }
  }

  // Check avoid signals
  for (const sig of signals) {
    if (config.avoid_signals.includes(sig)) {
      return { cancel: true, reason: `Senal ${sig} en lista de evitar (historicamente pierde)` };
    }
  }

  // Check worst combos
  const combo = [...signals].sort().join('+');
  if (config.worst_combos.includes(combo)) {
    return { cancel: true, reason: `Combo ${combo} historicamente pierde` };
  }

  return { cancel: false, reason: '' };
}
