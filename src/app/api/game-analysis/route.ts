import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { detectArbitrage } from '@/lib/analysis/arbitrage';
import { detectEv } from '@/lib/analysis/expected-value';
import { detectLineMovements, detectSteamMoves } from '@/lib/analysis/line-movement';
import {
  americanToImplied,
  americanToDecimal,
  powerDevig,
  formatOdds,
  formatPct,
  kellyFraction,
} from '@/lib/analysis/implied-probability';
import { BOOKMAKERS, MARKET_LABELS } from '@/lib/constants';
import type { LatestOdds, OddsSnapshot, Outcome } from '@/types/odds';

interface BetAnalysis {
  outcome_name: string;
  market_key: string;
  market_label: string;
  best_odds: number;
  best_bookmaker: string;
  best_bookmaker_name: string;
  fair_probability: number;
  implied_probability: number;
  edge_pct: number | null;
  kelly_fraction: number | null;
  has_value: boolean;
  confidence: 'alta' | 'media' | 'baja' | 'none';
  odds_by_book: Array<{
    bookmaker_key: string;
    bookmaker_name: string;
    odds: number;
    is_best: boolean;
    point?: number;
  }>;
  signals: Array<{
    type: string;
    label: string;
    detail: string;
    strength: 'strong' | 'moderate' | 'weak';
  }>;
  recommendation: string | null;
}

interface MarketAnalysis {
  market_key: string;
  market_label: string;
  has_arb: boolean;
  arb_profit: number | null;
  bets: BetAnalysis[];
}

interface GameAnalysisResponse {
  event_id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_key: string;
  completed: boolean;
  total_signals: number;
  best_bet: BetAnalysis | null;
  markets: MarketAnalysis[];
  expert_picks: Array<{
    expert_name: string;
    source: string;
    pick_description: string;
    confidence: string;
    record: string;
  }>;
}

const MARKETS = ['h2h', 'spreads', 'totals'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch event info
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Fetch latest odds for this event
  const { data: latestOdds } = await supabase
    .from('latest_odds')
    .select('*')
    .eq('event_id', eventId);

  const typedOdds = (latestOdds ?? []) as unknown as LatestOdds[];

  // Fetch previous snapshots for line movement
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: prevSnapshots } = await supabase
    .from('odds_snapshots')
    .select('*')
    .eq('event_id', eventId)
    .lt('fetched_at', thirtyMinsAgo)
    .order('fetched_at', { ascending: false })
    .limit(100);

  const { data: currentSnapshots } = await supabase
    .from('odds_snapshots')
    .select('*')
    .eq('event_id', eventId)
    .gte('fetched_at', thirtyMinsAgo)
    .limit(100);

  const typedPrev = (prevSnapshots ?? []) as unknown as OddsSnapshot[];
  const typedCurrent = (currentSnapshots ?? []) as unknown as OddsSnapshot[];
  const lineMovements = detectLineMovements(typedCurrent, typedPrev);
  const steamMoves = detectSteamMoves(lineMovements);

  // Fetch expert picks for this sport
  const sportShort = event.sport_key === 'basketball_nba' ? 'nba' : 'mlb';
  const { data: expertPicks } = await supabase
    .from('expert_picks')
    .select('*')
    .eq('sport', sportShort)
    .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as {
    data: Array<{
      expert_name: string;
      source: string;
      pick_description: string;
      confidence: string;
      record: string;
      sport: string;
    }> | null;
  };

  // Fetch existing recommendations for this event
  const { data: existingRecs } = await supabase
    .from('recommendations')
    .select('*')
    .eq('event_id', eventId)
    .gte('valid_until', new Date().toISOString()) as {
    data: Array<{
      market_key: string;
      outcome_name: string;
      reasoning: string;
    }> | null;
  };

  // Analyze each market
  const markets: MarketAnalysis[] = [];
  let bestBet: BetAnalysis | null = null;
  let totalSignals = 0;

  for (const marketKey of MARKETS) {
    const marketOdds = typedOdds.filter((o) => o.market_key === marketKey);
    if (marketOdds.length === 0) continue;

    // Arbitrage check
    const arbResult = detectArbitrage(eventId, marketKey, marketOdds);

    // EV check
    const evResults = detectEv(eventId, marketKey, marketOdds);

    // Collect all outcomes in this market
    const outcomeMap = new Map<string, Array<{ bookmaker_key: string; odds: number; point?: number }>>();
    for (const row of marketOdds) {
      for (const outcome of row.outcomes as Outcome[]) {
        const key = outcome.point != null ? `${outcome.name}|${outcome.point}` : outcome.name;
        const list = outcomeMap.get(key) ?? [];
        list.push({
          bookmaker_key: row.bookmaker_key,
          odds: outcome.price,
          point: outcome.point,
        });
        outcomeMap.set(key, list);
      }
    }

    // Compute fair probabilities for the market
    const outcomeKeys = Array.from(outcomeMap.keys());
    const avgOddsPerOutcome = outcomeKeys.map((key) => {
      const entries = outcomeMap.get(key)!;
      const avgImplied = entries.reduce((s, e) => s + americanToImplied(e.odds), 0) / entries.length;
      return avgImplied > 0.5
        ? -Math.round((avgImplied / (1 - avgImplied)) * 100)
        : Math.round(((1 - avgImplied) / avgImplied) * 100);
    });
    const fairProbs = avgOddsPerOutcome.length >= 2 ? powerDevig(avgOddsPerOutcome) : avgOddsPerOutcome.map(americanToImplied);

    const bets: BetAnalysis[] = [];

    for (let i = 0; i < outcomeKeys.length; i++) {
      const fullKey = outcomeKeys[i];
      const outcomeName = fullKey.includes('|') ? fullKey.split('|')[0] : fullKey;
      const entries = outcomeMap.get(fullKey)!;
      const fairProb = fairProbs[i];

      // Find best odds
      const sorted = [...entries].sort((a, b) => b.odds - a.odds);
      const best = sorted[0];
      const bestDecimal = americanToDecimal(best.odds);
      const impliedProb = americanToImplied(best.odds);
      const edge = fairProb * bestDecimal - 1;
      const hasValue = edge > 0.02;

      // Determine confidence
      let confidence: 'alta' | 'media' | 'baja' | 'none' = 'none';
      if (edge > 0.05) confidence = 'alta';
      else if (edge > 0.03) confidence = 'media';
      else if (edge > 0.02) confidence = 'baja';

      // Build signals
      const signals: BetAnalysis['signals'] = [];

      // EV signal
      const evMatch = evResults.find((e) => e.outcome_name === outcomeName);
      if (evMatch) {
        signals.push({
          type: 'ev',
          label: '+EV',
          detail: `${formatPct(evMatch.edge_pct)} ventaja vs línea justa ${formatOdds(evMatch.fair_odds)}`,
          strength: evMatch.confidence === 'alta' ? 'strong' : evMatch.confidence === 'media' ? 'moderate' : 'weak',
        });
      }

      // Arb signal
      if (arbResult) {
        const arbLeg = arbResult.legs.find((l) => l.outcome_name === outcomeName);
        if (arbLeg) {
          signals.push({
            type: 'arbitrage',
            label: 'Arbitraje',
            detail: `${formatPct(arbResult.profit_margin)} ganancia garantizada. Stake: ${formatPct(arbLeg.stake_pct)}`,
            strength: 'strong',
          });
        }
      }

      // Steam signal
      const steam = steamMoves.find(
        (s) => s.event_id === eventId && s.market_key === marketKey && s.outcome_name === outcomeName
      );
      if (steam) {
        signals.push({
          type: 'steam',
          label: 'Steam Move',
          detail: `${steam.bookmakers_moving.length} casas moviendo ${steam.direction === 'up' ? 'al alza' : 'a la baja'} (avg ${steam.average_change > 0 ? '+' : ''}${steam.average_change.toFixed(0)} cents)`,
          strength: steam.bookmakers_moving.length >= 4 ? 'strong' : 'moderate',
        });
      }

      // Line movement (non-steam)
      if (!steam) {
        const movements = lineMovements.filter(
          (m) => m.event_id === eventId && m.market_key === marketKey && m.outcome_name === outcomeName && m.is_significant
        );
        if (movements.length > 0) {
          const avgChange = movements.reduce((s, m) => s + m.change, 0) / movements.length;
          signals.push({
            type: 'movement',
            label: 'Movimiento',
            detail: `Línea moviéndose ${avgChange > 0 ? 'al alza' : 'a la baja'} en ${movements.length} casa(s)`,
            strength: 'weak',
          });
        }
      }

      // Expert alignment
      const matchingExperts = (expertPicks ?? []).filter((ep) => {
        const desc = (ep.pick_description ?? '').toLowerCase();
        const name = outcomeName.toLowerCase();
        const lastWord = name.split(' ').pop() ?? '';
        return desc.includes(name) ||
          (lastWord.length > 3 && desc.includes(lastWord)) ||
          (name === 'over' && desc.includes('over')) ||
          (name === 'under' && desc.includes('under'));
      });
      if (matchingExperts.length > 0) {
        const highConf = matchingExperts.filter((e) => e.confidence === 'alta').length;
        signals.push({
          type: 'expert',
          label: 'Expertos',
          detail: `${matchingExperts.length} experto(s) alineados${highConf > 0 ? `, ${highConf} con confianza alta` : ''}`,
          strength: highConf > 0 ? 'strong' : matchingExperts.length >= 2 ? 'moderate' : 'weak',
        });
      }

      // Discrepancy signal
      if (entries.length >= 2) {
        const disc = sorted[0].odds - sorted[sorted.length - 1].odds;
        if (disc > 20) {
          signals.push({
            type: 'discrepancy',
            label: 'Discrepancia',
            detail: `${disc} cents entre ${bookName(sorted[0].bookmaker_key)} (${formatOdds(sorted[0].odds)}) y ${bookName(sorted[sorted.length - 1].bookmaker_key)} (${formatOdds(sorted[sorted.length - 1].odds)})`,
            strength: disc > 40 ? 'strong' : 'moderate',
          });
        }
      }

      // Existing recommendation
      const existingRec = (existingRecs ?? []).find(
        (r) => r.market_key === marketKey && r.outcome_name === outcomeName
      );

      totalSignals += signals.length;

      // Build recommendation text
      let recommendation: string | null = null;
      if (signals.length >= 3) {
        recommendation = `Apuesta fuerte: ${signals.length} señales confirman ${outcomeName} en ${bookName(best.bookmaker_key)} a ${formatOdds(best.odds)}`;
      } else if (signals.length >= 2) {
        recommendation = `Buena oportunidad: ${outcomeName} en ${bookName(best.bookmaker_key)} a ${formatOdds(best.odds)}`;
      } else if (hasValue) {
        recommendation = `Valor detectado: ${outcomeName} a ${formatOdds(best.odds)} tiene ${formatPct(edge)} ventaja`;
      } else if (existingRec) {
        recommendation = existingRec.reasoning;
      }

      const bet: BetAnalysis = {
        outcome_name: outcomeName,
        market_key: marketKey,
        market_label: MARKET_LABELS[marketKey] ?? marketKey,
        best_odds: best.odds,
        best_bookmaker: best.bookmaker_key,
        best_bookmaker_name: bookName(best.bookmaker_key),
        fair_probability: fairProb,
        implied_probability: impliedProb,
        edge_pct: edge > 0 ? edge : null,
        kelly_fraction: hasValue ? kellyFraction(edge, bestDecimal) : null,
        has_value: hasValue,
        confidence,
        odds_by_book: entries
          .sort((a, b) => b.odds - a.odds)
          .map((e) => ({
            bookmaker_key: e.bookmaker_key,
            bookmaker_name: bookName(e.bookmaker_key),
            odds: e.odds,
            is_best: e.odds === best.odds && e.bookmaker_key === best.bookmaker_key,
            point: e.point,
          })),
        signals,
        recommendation,
      };

      bets.push(bet);

      // Track best bet across all markets
      if (
        (hasValue || signals.length >= 2) &&
        (!bestBet || signals.length > bestBet.signals.length || (edge > (bestBet.edge_pct ?? 0)))
      ) {
        bestBet = bet;
      }
    }

    markets.push({
      market_key: marketKey,
      market_label: MARKET_LABELS[marketKey] ?? marketKey,
      has_arb: !!arbResult,
      arb_profit: arbResult?.profit_margin ?? null,
      bets: bets.sort((a, b) => (b.signals.length - a.signals.length) || ((b.edge_pct ?? 0) - (a.edge_pct ?? 0))),
    });
  }

  const response: GameAnalysisResponse = {
    event_id: eventId,
    home_team: event.home_team,
    away_team: event.away_team,
    commence_time: event.commence_time,
    sport_key: event.sport_key,
    completed: event.completed,
    total_signals: totalSignals,
    best_bet: bestBet,
    markets,
    expert_picks: (expertPicks ?? [])
      .filter((ep) => {
        const desc = (ep.pick_description ?? '').toLowerCase();
        const home = event.home_team.toLowerCase();
        const away = event.away_team.toLowerCase();
        const homeWord = home.split(' ').pop() ?? '';
        const awayWord = away.split(' ').pop() ?? '';
        return desc.includes(home) || desc.includes(away) ||
          (homeWord.length > 3 && desc.includes(homeWord)) ||
          (awayWord.length > 3 && desc.includes(awayWord));
      })
      .map((ep) => ({
        expert_name: ep.expert_name,
        source: ep.source,
        pick_description: ep.pick_description,
        confidence: ep.confidence,
        record: ep.record,
      })),
  };

  return NextResponse.json(response);
}

function bookName(key: string): string {
  return BOOKMAKERS[key]?.name ?? key;
}
