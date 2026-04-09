/**
 * Core odds math utilities for sports betting analysis.
 */

/** Convert American odds to decimal format */
export function americanToDecimal(odds: number): number {
  if (odds > 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}

/** Convert decimal odds to American format */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/** Convert American odds to implied probability (0-1) */
export function americanToImplied(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Remove vig from a set of outcomes to get fair probabilities */
export function removeVig(impliedProbs: number[]): number[] {
  const total = impliedProbs.reduce((sum, p) => sum + p, 0);
  return impliedProbs.map((p) => p / total);
}

/**
 * Power devig method (more accurate than basic multiplicative).
 * Takes American odds for each outcome, returns fair probabilities.
 */
export function powerDevig(americanOdds: number[]): number[] {
  const implied = americanOdds.map(americanToImplied);
  const totalVig = implied.reduce((sum, p) => sum + p, 0);

  if (totalVig <= 1) return implied; // no vig to remove

  // Use power method: find exponent k such that sum(p_i^k) = 1
  let lo = 0.01;
  let hi = 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const sum = implied.reduce((s, p) => s + Math.pow(p, mid), 0);
    if (sum > 1) hi = mid;
    else lo = mid;
  }
  const k = (lo + hi) / 2;
  return implied.map((p) => Math.pow(p, k));
}

/**
 * Calculate Kelly criterion fraction for optimal bet sizing.
 * @param edge - The edge as a decimal (e.g., 0.05 for 5%)
 * @param decimalOdds - The decimal odds offered
 * @returns Optimal fraction of bankroll to bet
 */
export function kellyFraction(edge: number, decimalOdds: number): number {
  const b = decimalOdds - 1;
  if (b <= 0) return 0;
  const fraction = edge / b;
  // Quarter Kelly for safety
  return Math.max(0, fraction * 0.25);
}

/** Explain odds in simple Spanish for a given stake */
export function explainOdds(odds: number, stake: number = 50): string {
  if (odds === 0) return '';
  if (odds > 0) {
    const profit = (odds / 100) * stake;
    return `Apostar $${stake} para ganar $${profit.toFixed(2)}`;
  } else {
    const profit = (100 / Math.abs(odds)) * stake;
    return `Apostar $${stake} para ganar $${profit.toFixed(2)}`;
  }
}

/** Calculate total implied probability for arbitrage detection */
export function totalImpliedProbability(americanOdds: number[]): number {
  return americanOdds.reduce((sum, odds) => sum + americanToImplied(odds), 0);
}

/** Format American odds for display */
export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/** Format probability as percentage */
export function formatPct(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`;
}

/** Calculate potential payout from American odds and stake */
export function calculatePayout(odds: number, stake: number): number {
  const decimal = americanToDecimal(odds);
  return stake * decimal;
}

/** Calculate profit from American odds and stake */
export function calculateProfit(odds: number, stake: number): number {
  return calculatePayout(odds, stake) - stake;
}
