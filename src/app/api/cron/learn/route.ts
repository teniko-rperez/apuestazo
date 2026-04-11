import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { learnFromHistory, shouldCancelBet } from '@/lib/analysis/learning-engine';

/**
 * Daily learning cron (6am).
 * Analyzes every loss, finds patterns, aggressively adjusts thresholds.
 * Goal: win rate approaching 70%+ by being extremely selective.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const summary: Record<string, unknown> = {};

  try {
    // 1. Get ALL settled bets with full details
    const { data: settledBets } = await supabase
      .from('simulated_bets')
      .select('result, profit, reasoning, odds, outcome_name, events(home_team)')
      .in('result', ['won', 'lost', 'push'])
      .limit(1000);

    const learningInput = (settledBets ?? []).map((b: Record<string, unknown>) => ({
      result: b.result as 'won' | 'lost' | 'push',
      profit: (b.profit as number) ?? 0,
      reasoning: (b.reasoning as string) ?? '',
      odds: b.odds as number | undefined,
      outcome_name: b.outcome_name as string | undefined,
      home_team: ((b.events as Record<string, unknown>)?.home_team as string) ?? undefined,
    }));

    summary.betsAnalyzed = learningInput.length;

    // 2. Run learning with deep loss analysis
    const config = learnFromHistory(learningInput);
    summary.overallWinRate = `${(config.overall_win_rate * 100).toFixed(1)}%`;
    summary.minConfidence = config.min_confidence;
    summary.minSignals = config.min_signals;
    summary.minCategories = config.min_categories;
    summary.maxOdds = config.max_odds;
    summary.minOdds = config.min_odds;
    summary.avoidSignals = config.avoid_signals;
    summary.bestCombos = config.best_combos;
    summary.worstCombos = config.worst_combos;
    summary.lossPatterns = config.loss_analysis.length;
    summary.adjustments = config.adjustments_made;

    // 3. Store learning history
    const changes: Record<string, { from: number; to: number; reason: string }> = {};
    const DEFAULT_W: Record<string, number> = {
      FAVORITO: 0.50, ARB: 0.15, STEAM: 0.12, LINE_MOVE: 0.06, EXPERT: 0.10,
      DISCREPANCY: 0.08, CONTRARIAN: 0.06, ROBINHOOD: 0.10, POLYMARKET: 0.08,
      STATS: 0.10, WEATHER: 0.06, ALTITUDE: 0.08, PACE: 0.10, FATIGUE: 0.08,
      REST: 0.06, HOME: 0.05, CLV: 0.10, STREAK: 0.06, REGRESSION: 0.06,
      PLAYOFF: 0.08, TANK: 0.06, INJURY: 0.20,
    };
    for (const [signal, newW] of Object.entries(config.signal_weights)) {
      const oldW = DEFAULT_W[signal] ?? 0.12;
      if (Math.abs(newW - oldW) > 0.01) {
        changes[signal] = { from: oldW, to: newW, reason: newW > oldW ? 'Win rate alta' : 'Win rate baja' };
      }
    }

    await supabase.from('learning_history').insert({
      config: { ...config, loss_analysis: config.loss_analysis.slice(0, 10) }, // limit stored analysis
      signal_changes: changes,
      bets_analyzed: config.total_bets_analyzed,
      win_rate: config.overall_win_rate,
    });

    // 4. Cancel ALL pending bets that don't meet NEW learned thresholds
    const { data: pendingBets } = await supabase
      .from('simulated_bets')
      .select('id, event_id, reasoning, odds')
      .eq('result', 'pending');

    let cancelled = 0;
    if (pendingBets && pendingBets.length > 0) {
      // Batch load event times + active recommendations to avoid N+1
      const pendingEventIds = [...new Set(pendingBets.map((b) => b.event_id as string))];
      const nowIso = new Date().toISOString();

      const [{ data: batchEvents }, { data: batchRecs }] = await Promise.all([
        supabase.from('events').select('id, commence_time').in('id', pendingEventIds),
        supabase.from('recommendations').select('event_id, confidence_score, reasoning')
          .in('event_id', pendingEventIds).gte('valid_until', nowIso)
          .order('confidence_score', { ascending: false }),
      ]);

      const eventTimeMap = new Map((batchEvents ?? []).map((e) => [e.id as string, e.commence_time as string]));
      const bestRecByEvent = new Map<string, { confidence_score: number; reasoning: string }>();
      for (const rec of (batchRecs ?? []) as Array<Record<string, unknown>>) {
        const eid = rec.event_id as string;
        if (!bestRecByEvent.has(eid)) {
          bestRecByEvent.set(eid, {
            confidence_score: rec.confidence_score as number,
            reasoning: (rec.reasoning as string) ?? '',
          });
        }
      }

      const cancelUpdates: Array<{ id: unknown; reasoning: string }> = [];
      const now = Date.now();

      for (const bet of pendingBets) {
        const commence = eventTimeMap.get(bet.event_id as string);
        if (commence && new Date(commence).getTime() < now) continue;

        const odds = bet.odds as number;
        if (odds > 0 && odds > config.max_odds) {
          cancelUpdates.push({ id: bet.id, reasoning: (bet.reasoning ?? '') + ` [CANCELADA por learning: odds +${odds} > max +${config.max_odds}]` });
          continue;
        }
        if (odds < 0 && odds < config.min_odds) {
          cancelUpdates.push({ id: bet.id, reasoning: (bet.reasoning ?? '') + ` [CANCELADA por learning: odds ${odds} < min ${config.min_odds}]` });
          continue;
        }

        const rec = bestRecByEvent.get(bet.event_id as string);
        if (!rec) {
          cancelUpdates.push({ id: bet.id, reasoning: (bet.reasoning ?? '') + ' [CANCELADA por learning: sin recomendacion activa]' });
          continue;
        }

        const { cancel, reason } = shouldCancelBet(rec.reasoning, rec.confidence_score, config, odds);
        if (cancel) {
          cancelUpdates.push({ id: bet.id, reasoning: (bet.reasoning ?? '') + ` [CANCELADA por learning: ${reason}]` });
        }
      }

      // Apply cancellations (still individual updates — Supabase has no batch-update-by-id)
      const settledAt = new Date().toISOString();
      for (const u of cancelUpdates) {
        await supabase.from('simulated_bets').update({
          result: 'cancelled', profit: 0, settled_at: settledAt, reasoning: u.reasoning,
        }).eq('id', u.id);
        cancelled++;
      }
    }
    summary.betsCancelled = cancelled;

    // 5. Cleanup
    try { await supabase.rpc('cleanup_old_data'); } catch { /* ok */ }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
