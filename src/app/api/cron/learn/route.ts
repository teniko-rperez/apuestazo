import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { learnFromHistory, shouldCancelBet } from '@/lib/analysis/learning-engine';

/**
 * Daily learning cron job.
 * Runs once per day to analyze all settled bets and optimize the engine.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const summary: Record<string, unknown> = {};

  try {
    // 1. Get all settled bets
    const { data: settledBets } = await supabase
      .from('simulated_bets')
      .select('result, profit, reasoning')
      .in('result', ['won', 'lost', 'push'])
      .limit(1000);

    const learningInput = (settledBets ?? []).map((b: Record<string, unknown>) => ({
      result: b.result as 'won' | 'lost' | 'push',
      profit: (b.profit as number) ?? 0,
      reasoning: (b.reasoning as string) ?? '',
      confidence_score: undefined as number | undefined,
    }));

    summary.betsAnalyzed = learningInput.length;

    // 2. Run learning algorithm
    const config = learnFromHistory(learningInput);
    summary.overallWinRate = `${(config.overall_win_rate * 100).toFixed(1)}%`;
    summary.minConfidence = config.min_confidence;
    summary.minSignals = config.min_signals;
    summary.minCategories = config.min_categories;
    summary.bestCombos = config.best_combos;
    summary.worstCombos = config.worst_combos;

    // 3. Calculate weight changes vs defaults
    const DEFAULT_WEIGHTS: Record<string, number> = {
      EV: 0.30, ARB: 0.25, STEAM: 0.20, LINE_MOVE: 0.10,
      EXPERT: 0.18, DISCREPANCY: 0.12, CONTRARIAN: 0.10,
      ROBINHOOD: 0.16, POLYMARKET: 0.14, STATS: 0.16,
      WEATHER: 0.12, ALTITUDE: 0.14, PACE: 0.16,
      FATIGUE: 0.14, REST: 0.10, HOME: 0.08,
      CLV: 0.18, STREAK: 0.10, REGRESSION: 0.12,
      PLAYOFF: 0.14, TANK: 0.12,
    };

    const changes: Record<string, { from: number; to: number; reason: string }> = {};
    for (const [signal, newWeight] of Object.entries(config.signal_weights)) {
      const oldWeight = DEFAULT_WEIGHTS[signal] ?? 0.12;
      if (Math.abs(newWeight - oldWeight) > 0.01) {
        const direction = newWeight > oldWeight ? 'aumentado' : 'reducido';
        changes[signal] = {
          from: oldWeight,
          to: newWeight,
          reason: `Peso ${direction} de ${(oldWeight * 100).toFixed(0)}% a ${(newWeight * 100).toFixed(0)}% basado en win rate historico`,
        };
      }
    }
    summary.weightChanges = Object.keys(changes).length;

    // 4. Store learning history
    await supabase.from('learning_history').insert({
      config,
      signal_changes: changes,
      bets_analyzed: config.total_bets_analyzed,
      win_rate: config.overall_win_rate,
    });

    // 5. Cancel pending bets that don't meet learned thresholds
    const { data: pendingBets } = await supabase
      .from('simulated_bets')
      .select('id, reasoning, event_id')
      .eq('result', 'pending');

    let cancelled = 0;
    if (pendingBets) {
      for (const bet of pendingBets) {
        // Don't cancel bets for games that already started
        const { data: ev } = await supabase.from('events')
          .select('commence_time')
          .eq('id', bet.event_id)
          .single();
        if (ev && new Date(ev.commence_time as string).getTime() < Date.now()) continue;

        // Check if still has valid recommendation
        const { data: recs } = await supabase.from('recommendations')
          .select('confidence_score, reasoning')
          .eq('event_id', bet.event_id)
          .gte('valid_until', new Date().toISOString())
          .order('confidence_score', { ascending: false })
          .limit(1);

        if (!recs || recs.length === 0) {
          await supabase.from('simulated_bets').update({
            result: 'push', profit: 0,
            reasoning: (bet.reasoning ?? '') + ' [CANCELADA: sin recomendacion activa despues de learning]',
            settled_at: new Date().toISOString(),
          }).eq('id', bet.id);
          cancelled++;
          continue;
        }

        const { cancel, reason } = shouldCancelBet(
          recs[0].reasoning as string,
          recs[0].confidence_score as number,
          config
        );
        if (cancel) {
          await supabase.from('simulated_bets').update({
            result: 'push', profit: 0,
            reasoning: (bet.reasoning ?? '') + ` [CANCELADA por learning: ${reason}]`,
            settled_at: new Date().toISOString(),
          }).eq('id', bet.id);
          cancelled++;
        }
      }
    }
    summary.betsCancelled = cancelled;

    // 6. Cleanup old data
    try {
      await supabase.rpc('cleanup_old_data');
      summary.cleanup = true;
    } catch { /* ok */ }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
