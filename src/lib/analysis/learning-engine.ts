/**
 * Self-Learning Engine.
 * Analyzes past bet results to optimize signal weights dynamically.
 *
 * How it works:
 * 1. Looks at all settled bets and their reasoning (which signals were used)
 * 2. Calculates win rate per signal and per signal combination
 * 3. Adjusts weights: signals that win more get higher weight, losers get lower
 * 4. Raises minimum confidence threshold based on historical performance
 * 5. Cancels bets that no longer meet the learned thresholds
 */

export interface SignalPerformance {
  signal: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit: number;
  learned_weight: number;  // adjusted weight based on performance
  original_weight: number;
}

export interface LearnedConfig {
  signal_weights: Record<string, number>;
  min_confidence: number;
  min_signals: number;
  min_categories: number;
  best_combos: string[];  // signal combos with highest win rate
  worst_combos: string[]; // signal combos to avoid
  total_bets_analyzed: number;
  overall_win_rate: number;
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

/**
 * Analyze all settled bets and learn optimal weights.
 */
export function learnFromHistory(
  settledBets: Array<{
    result: 'won' | 'lost' | 'push';
    profit: number;
    reasoning: string;
    confidence_score?: number;
  }>
): LearnedConfig {
  if (settledBets.length < 5) {
    // Not enough data to learn, return defaults
    return {
      signal_weights: { ...DEFAULT_WEIGHTS },
      min_confidence: 0.12,
      min_signals: 1,
      min_categories: 1,
      best_combos: [],
      worst_combos: [],
      total_bets_analyzed: settledBets.length,
      overall_win_rate: 0,
      last_learned: new Date().toISOString(),
    };
  }

  // ─── Step 1: Extract signals from each bet's reasoning ───
  const signalStats = new Map<string, { wins: number; losses: number; profit: number }>();
  const comboStats = new Map<string, { wins: number; losses: number; profit: number }>();
  const confidenceResults: Array<{ confidence: number; won: boolean }> = [];

  for (const bet of settledBets) {
    if (bet.result === 'push') continue;
    const won = bet.result === 'won';

    // Parse signals from reasoning: [SIGNAL1 + SIGNAL2 + ...]
    const signalMatch = bet.reasoning?.match(/\[([^\]]+)\]/);
    const signals = signalMatch
      ? signalMatch[1].split('+').map((s) => s.trim()).filter(Boolean)
      : [];

    // Track per-signal performance
    for (const signal of signals) {
      const stat = signalStats.get(signal) ?? { wins: 0, losses: 0, profit: 0 };
      if (won) stat.wins++;
      else stat.losses++;
      stat.profit += bet.profit;
      signalStats.set(signal, stat);
    }

    // Track combo performance (sorted signal combination)
    if (signals.length >= 2) {
      const comboKey = [...signals].sort().join('+');
      const stat = comboStats.get(comboKey) ?? { wins: 0, losses: 0, profit: 0 };
      if (won) stat.wins++;
      else stat.losses++;
      stat.profit += bet.profit;
      comboStats.set(comboKey, stat);
    }

    // Track confidence vs result
    if (bet.confidence_score) {
      confidenceResults.push({ confidence: bet.confidence_score, won });
    }
  }

  // ─── Step 2: Calculate learned weights ───
  const learnedWeights: Record<string, number> = { ...DEFAULT_WEIGHTS };
  const performances: SignalPerformance[] = [];

  for (const [signal, stat] of signalStats) {
    const total = stat.wins + stat.losses;
    if (total < 3) continue; // Need at least 3 samples

    const winRate = stat.wins / total;
    const originalWeight = DEFAULT_WEIGHTS[signal] ?? 0.12;

    // Adjust weight based on performance
    // Win rate > 60% = boost, < 40% = reduce, 40-60% = keep
    let adjustment: number;
    if (winRate >= 0.70) adjustment = 1.5;      // Great signal, boost 50%
    else if (winRate >= 0.60) adjustment = 1.25; // Good signal, boost 25%
    else if (winRate >= 0.50) adjustment = 1.0;  // Average, keep
    else if (winRate >= 0.40) adjustment = 0.75; // Below average, reduce 25%
    else adjustment = 0.5;                        // Bad signal, halve it

    const newWeight = Math.max(0.05, Math.min(0.40, originalWeight * adjustment));
    learnedWeights[signal] = Math.round(newWeight * 100) / 100;

    performances.push({
      signal,
      total,
      wins: stat.wins,
      losses: stat.losses,
      win_rate: winRate,
      profit: stat.profit,
      learned_weight: newWeight,
      original_weight: originalWeight,
    });
  }

  // ─── Step 3: Find best and worst combos ───
  const bestCombos: string[] = [];
  const worstCombos: string[] = [];

  for (const [combo, stat] of comboStats) {
    const total = stat.wins + stat.losses;
    if (total < 3) continue;
    const winRate = stat.wins / total;

    if (winRate >= 0.70 && total >= 3) bestCombos.push(combo);
    if (winRate <= 0.35 && total >= 3) worstCombos.push(combo);
  }

  // ─── Step 4: Learn optimal minimum confidence ───
  // Find the confidence threshold where win rate is highest
  let bestMinConf = 0.12;
  let bestWinRate = 0;

  for (const threshold of [0.15, 0.20, 0.25, 0.30, 0.35, 0.40]) {
    const filtered = confidenceResults.filter((r) => r.confidence >= threshold);
    if (filtered.length < 5) continue;
    const wr = filtered.filter((r) => r.won).length / filtered.length;
    if (wr > bestWinRate) {
      bestWinRate = wr;
      bestMinConf = threshold;
    }
  }

  // ─── Step 5: Learn minimum signals and categories ───
  // Parse category count from reasoning: (X/3 categorias, Y senales)
  const signalCountResults: Array<{ count: number; won: boolean }> = [];
  const catCountResults: Array<{ count: number; won: boolean }> = [];

  for (const bet of settledBets) {
    if (bet.result === 'push') continue;
    const won = bet.result === 'won';

    const catMatch = bet.reasoning?.match(/(\d)\/3 categorias, (\d+) senales/);
    if (catMatch) {
      catCountResults.push({ count: parseInt(catMatch[1]), won });
      signalCountResults.push({ count: parseInt(catMatch[2]), won });
    }
  }

  // Find min signals where win rate > 55%
  let learnedMinSignals = 1;
  for (const min of [2, 3, 4, 5]) {
    const filtered = signalCountResults.filter((r) => r.count >= min);
    if (filtered.length < 5) continue;
    const wr = filtered.filter((r) => r.won).length / filtered.length;
    if (wr >= 0.55) learnedMinSignals = min;
  }

  let learnedMinCats = 1;
  for (const min of [2, 3]) {
    const filtered = catCountResults.filter((r) => r.count >= min);
    if (filtered.length < 5) continue;
    const wr = filtered.filter((r) => r.won).length / filtered.length;
    if (wr >= 0.55) learnedMinCats = min;
  }

  const totalWon = settledBets.filter((b) => b.result === 'won').length;
  const totalLost = settledBets.filter((b) => b.result === 'lost').length;

  return {
    signal_weights: learnedWeights,
    min_confidence: bestMinConf,
    min_signals: learnedMinSignals,
    min_categories: learnedMinCats,
    best_combos: bestCombos.slice(0, 5),
    worst_combos: worstCombos.slice(0, 5),
    total_bets_analyzed: settledBets.length,
    overall_win_rate: totalWon + totalLost > 0 ? totalWon / (totalWon + totalLost) : 0,
    last_learned: new Date().toISOString(),
  };
}

/**
 * Should this bet be cancelled based on learned thresholds?
 */
export function shouldCancelBet(
  reasoning: string,
  confidence: number,
  config: LearnedConfig
): { cancel: boolean; reason: string } {
  // Check minimum confidence
  if (confidence < config.min_confidence) {
    return { cancel: true, reason: `Confianza ${(confidence * 100).toFixed(0)}% < minimo aprendido ${(config.min_confidence * 100).toFixed(0)}%` };
  }

  // Parse signals and categories
  const signalMatch = reasoning?.match(/\[([^\]]+)\]/);
  const signals = signalMatch ? signalMatch[1].split('+').map((s) => s.trim()) : [];
  const catMatch = reasoning?.match(/(\d)\/3 categorias, (\d+) senales/);
  const signalCount = catMatch ? parseInt(catMatch[2]) : signals.length;
  const catCount = catMatch ? parseInt(catMatch[1]) : 1;

  if (signalCount < config.min_signals) {
    return { cancel: true, reason: `${signalCount} senales < minimo aprendido ${config.min_signals}` };
  }

  if (catCount < config.min_categories) {
    return { cancel: true, reason: `${catCount} categorias < minimo aprendido ${config.min_categories}` };
  }

  // Check if signal combo is in worst combos
  const comboKey = [...signals].sort().join('+');
  if (config.worst_combos.includes(comboKey)) {
    return { cancel: true, reason: `Combo ${comboKey} historicamente pierde` };
  }

  return { cancel: false, reason: '' };
}
