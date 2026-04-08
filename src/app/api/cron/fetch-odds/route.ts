import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchEvents, fetchOdds, fetchScores } from '@/lib/odds-api/client';
import {
  getRemainingCredits,
  logApiUsage,
  canAffordRequest,
  isEmergencyMode,
} from '@/lib/odds-api/budget-tracker';
import { findAllArbitrages } from '@/lib/analysis/arbitrage';
import { findAllEvOpportunities } from '@/lib/analysis/expected-value';
import { buildParlays } from '@/lib/analysis/parlay-builder';
import { formatOdds, formatPct } from '@/lib/analysis/implied-probability';
import { BOOKMAKERS } from '@/lib/constants';
import type { LatestOdds } from '@/types/odds';

const SPORT_KEYS = ['basketball_nba', 'baseball_mlb'];
const GAME_MARKETS = ['h2h', 'spreads', 'totals'];

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const summary: Record<string, unknown> = {};
  let totalCreditsSpent = 0;

  try {
    for (const sportKey of SPORT_KEYS) {
      const sportSummary: Record<string, unknown> = {};

      // 1. Fetch events (FREE)
      const events = await fetchEvents(sportKey);
      sportSummary.totalEvents = events.length;

      // Upsert events
      if (events.length > 0) {
        const { error: eventsError } = await supabase.from('events').upsert(
          events.map((e) => ({
            id: e.id,
            sport_key: e.sport_key,
            commence_time: e.commence_time,
            home_team: e.home_team,
            away_team: e.away_team,
          })),
          { onConflict: 'id' }
        );
        if (eventsError) console.error('Error upserting events:', eventsError);
      }

      // Fetch scores for completed games (FREE)
      try {
        const scores = await fetchScores(sportKey);
        for (const score of scores) {
          if (score.completed && score.scores) {
            const homeScore = score.scores.find((s) => s.name === score.home_team);
            const awayScore = score.scores.find((s) => s.name === score.away_team);
            await supabase
              .from('events')
              .update({
                completed: true,
                scores: {
                  home: homeScore ? parseInt(homeScore.score) : 0,
                  away: awayScore ? parseInt(awayScore.score) : 0,
                },
              })
              .eq('id', score.id);
          }
        }
      } catch (e) {
        console.error('Error fetching scores:', e);
      }

      // 2. Check poll schedule
      const { data: schedule } = await supabase
        .from('poll_schedule')
        .select('*')
        .eq('sport_key', sportKey)
        .single();

      const now = new Date();

      // Calculate if it's game day and optimal polling interval
      const todayEvents = events.filter((e) => {
        const gameTime = new Date(e.commence_time);
        return gameTime.toDateString() === now.toDateString();
      });

      const nextGame = todayEvents
        .map((e) => new Date(e.commence_time))
        .filter((d) => d > now)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      const hoursToNextGame = nextGame
        ? (nextGame.getTime() - now.getTime()) / (1000 * 60 * 60)
        : Infinity;

      // Determine polling interval
      let pollIntervalMinutes = 120; // default: every 2 hours
      if (todayEvents.length === 0) {
        pollIntervalMinutes = 360; // no games: check every 6 hours
      } else if (hoursToNextGame <= 2) {
        pollIntervalMinutes = 30; // games soon or live
      } else if (hoursToNextGame <= 6) {
        pollIntervalMinutes = 60; // games in a few hours
      }

      // Update poll schedule
      await supabase
        .from('poll_schedule')
        .update({
          games_today: todayEvents.length,
          is_game_day: todayEvents.length > 0,
          poll_interval_minutes: pollIntervalMinutes,
        })
        .eq('sport_key', sportKey);

      // Check if it's time to poll
      if (schedule?.next_poll_at && new Date(schedule.next_poll_at) > now) {
        sportSummary.skipped = true;
        sportSummary.nextPollAt = schedule.next_poll_at;
        summary[sportKey] = sportSummary;
        continue;
      }

      // 3. Check budget
      const remaining = await getRemainingCredits(supabase);
      const cost = GAME_MARKETS.length; // 3 credits

      if (!canAffordRequest(remaining, cost)) {
        sportSummary.skipped = true;
        sportSummary.reason = 'insufficient_credits';
        sportSummary.remainingCredits = remaining;
        summary[sportKey] = sportSummary;
        continue;
      }

      // In emergency mode, only fetch h2h for the most important game
      const markets = isEmergencyMode(remaining) ? ['h2h'] : GAME_MARKETS;

      // 4. Fetch odds (COSTS credits)
      const { events: oddsEvents, creditsUsed } = await fetchOdds(sportKey, markets);
      totalCreditsSpent += creditsUsed;

      await logApiUsage(supabase, `/sports/${sportKey}/odds`, creditsUsed, sportKey, markets);

      // 5. Store odds snapshots
      const fetchedAt = new Date().toISOString();
      const snapshots: Array<{
        event_id: string;
        bookmaker_key: string;
        market_key: string;
        outcomes: unknown;
        fetched_at: string;
      }> = [];

      for (const event of oddsEvents) {
        for (const bookmaker of event.bookmakers) {
          for (const market of bookmaker.markets) {
            snapshots.push({
              event_id: event.id,
              bookmaker_key: bookmaker.key,
              market_key: market.key,
              outcomes: market.outcomes,
              fetched_at: fetchedAt,
            });
          }
        }
      }

      if (snapshots.length > 0) {
        const { error: snapError } = await supabase
          .from('odds_snapshots')
          .insert(snapshots);
        if (snapError) console.error('Error inserting snapshots:', snapError);
      }

      sportSummary.oddsStored = snapshots.length;
      sportSummary.creditsUsed = creditsUsed;

      // Update next poll time
      await supabase
        .from('poll_schedule')
        .update({
          last_polled_at: now.toISOString(),
          next_poll_at: new Date(
            now.getTime() + pollIntervalMinutes * 60 * 1000
          ).toISOString(),
        })
        .eq('sport_key', sportKey);

      summary[sportKey] = sportSummary;
    }

    // 6. Refresh materialized view
    await supabase.rpc('refresh_latest_odds');

    // 7. Run analysis on latest odds
    const { data: latestOdds } = await supabase
      .from('latest_odds')
      .select('*');

    if (latestOdds && latestOdds.length > 0) {
      const typedOdds = latestOdds as unknown as LatestOdds[];

      // Arbitrage detection
      const arbs = findAllArbitrages(typedOdds);
      if (arbs.length > 0) {
        // Mark old arbs as expired first
        await supabase
          .from('arbitrage_opportunities')
          .update({ status: 'expired' })
          .eq('status', 'active');

        const { error: arbError } = await supabase
          .from('arbitrage_opportunities')
          .insert(
            arbs.map((a) => ({
              event_id: a.event_id,
              market_key: a.market_key,
              profit_margin: a.profit_margin,
              legs: a.legs,
              total_implied_probability: a.total_implied_probability,
              status: 'active',
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
            }))
          );
        if (arbError) console.error('Error inserting arbs:', arbError);
      }
      summary.arbitrageFound = arbs.length;

      // +EV detection
      const evs = findAllEvOpportunities(typedOdds);
      if (evs.length > 0) {
        await supabase
          .from('ev_opportunities')
          .update({ status: 'expired' })
          .eq('status', 'active');

        const { error: evError } = await supabase
          .from('ev_opportunities')
          .insert(
            evs.map((e) => ({
              event_id: e.event_id,
              market_key: e.market_key,
              outcome_name: e.outcome_name,
              bookmaker_key: e.bookmaker_key,
              odds: e.odds,
              fair_odds: e.fair_odds,
              edge_pct: e.edge_pct,
              kelly_fraction: e.kelly_fraction,
              confidence: e.confidence,
              status: 'active',
            }))
          );
        if (evError) console.error('Error inserting EVs:', evError);
      }
      summary.evFound = evs.length;

      // Generate recommendations
      const recommendations: Array<{
        event_id: string;
        type: string;
        market_key: string;
        outcome_name: string;
        bookmaker_key: string;
        odds: number;
        reasoning: string;
        confidence_score: number;
        valid_until: string;
      }> = [];

      // Arb recommendations
      for (const arb of arbs.slice(0, 3)) {
        for (const leg of arb.legs) {
          recommendations.push({
            event_id: arb.event_id,
            type: 'arbitrage',
            market_key: arb.market_key,
            outcome_name: leg.outcome_name,
            bookmaker_key: leg.bookmaker,
            odds: leg.odds,
            reasoning: `Oportunidad de arbitraje con ${formatPct(arb.profit_margin)} de ganancia garantizada. Apostar ${formatPct(leg.stake_pct)} del bankroll en ${BOOKMAKERS[leg.bookmaker]?.name ?? leg.bookmaker}.`,
            confidence_score: Math.min(0.99, 0.9 + arb.profit_margin),
            valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // EV recommendations
      for (const ev of evs.slice(0, 5)) {
        recommendations.push({
          event_id: ev.event_id,
          type: 'ev',
          market_key: ev.market_key,
          outcome_name: ev.outcome_name,
          bookmaker_key: ev.bookmaker_key,
          odds: ev.odds,
          reasoning: `Apuesta con valor positivo: ${formatPct(ev.edge_pct)} de ventaja. Odds ${formatOdds(ev.odds)} en ${BOOKMAKERS[ev.bookmaker_key]?.name ?? ev.bookmaker_key} vs odds justas de ${formatOdds(ev.fair_odds)}. Confianza ${ev.confidence}.`,
          confidence_score: ev.confidence === 'alta' ? 0.85 : ev.confidence === 'media' ? 0.7 : 0.55,
          valid_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Parlay recommendations
      const parlays = buildParlays(evs);
      for (const parlay of parlays.slice(0, 2)) {
        for (const leg of parlay.legs) {
          recommendations.push({
            event_id: leg.event_id,
            type: 'parlay_leg',
            market_key: leg.market_key,
            outcome_name: leg.outcome_name,
            bookmaker_key: leg.bookmaker_key,
            odds: leg.odds,
            reasoning: `Leg de parlay sugerido en ${BOOKMAKERS[leg.bookmaker_key]?.name ?? leg.bookmaker_key}. Odds combinadas: +${parlay.combined_odds}. Ventaja combinada: ${formatPct(parlay.combined_edge)}.`,
            confidence_score: 0.6,
            valid_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      if (recommendations.length > 0) {
        // Clear old recommendations
        await supabase
          .from('recommendations')
          .delete()
          .lt('valid_until', new Date().toISOString());

        const { error: recError } = await supabase
          .from('recommendations')
          .insert(recommendations);
        if (recError) console.error('Error inserting recommendations:', recError);
      }
      summary.recommendations = recommendations.length;
    }

    // 8. Expire old opportunities
    await supabase.rpc('expire_old_opportunities');

    summary.totalCreditsSpent = totalCreditsSpent;
    summary.remainingCredits = await getRemainingCredits(supabase);

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
