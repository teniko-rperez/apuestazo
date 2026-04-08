import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchEspnScoreboard } from '@/lib/scrapers/espn';
import { fetchAllExpertPicks } from '@/lib/scrapers/experts';
import { findAllArbitrages } from '@/lib/analysis/arbitrage';
import { findAllEvOpportunities } from '@/lib/analysis/expected-value';
import { buildParlays } from '@/lib/analysis/parlay-builder';
import { formatOdds, formatPct } from '@/lib/analysis/implied-probability';
import { BOOKMAKERS } from '@/lib/constants';
import type { LatestOdds } from '@/types/odds';

const SPORT_KEYS = ['basketball_nba', 'baseball_mlb'];

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const summary: Record<string, unknown> = {};

  try {
    for (const sportKey of SPORT_KEYS) {
      const sportSummary: Record<string, unknown> = {};

      // 1. Scrape ESPN scoreboard (FREE, no API key needed)
      try {
        const { events, odds } = await fetchEspnScoreboard(sportKey);
        sportSummary.totalEvents = events.length;
        sportSummary.totalOdds = odds.length;

        // Upsert events
        if (events.length > 0) {
          const { error: eventsError } = await supabase.from('events').upsert(
            events.map((e) => ({
              id: e.id,
              sport_key: e.sport_key,
              commence_time: e.commence_time,
              home_team: e.home_team,
              away_team: e.away_team,
              completed: e.completed,
              scores: e.scores,
            })),
            { onConflict: 'id' }
          );
          if (eventsError) console.error('Error upserting events:', eventsError);
        }

        // Store odds snapshots
        const fetchedAt = new Date().toISOString();
        if (odds.length > 0) {
          const snapshots = odds.map((o) => ({
            event_id: o.event_id,
            bookmaker_key: o.bookmaker_key,
            market_key: o.market_key,
            outcomes: o.outcomes,
            fetched_at: fetchedAt,
          }));

          const { error: snapError } = await supabase
            .from('odds_snapshots')
            .insert(snapshots);
          if (snapError) console.error('Error inserting snapshots:', snapError);
          sportSummary.oddsStored = snapshots.length;
        }
      } catch (e) {
        console.error(`Error scraping ESPN for ${sportKey}:`, e);
        sportSummary.espnError = String(e);
      }

      // 2. Scrape expert picks
      const sportShort = sportKey === 'basketball_nba' ? 'nba' : 'mlb';
      try {
        const expertPicks = await fetchAllExpertPicks(sportShort as 'nba' | 'mlb');
        if (expertPicks.length > 0) {
          // Clear old picks for this sport (keep last 24h)
          await supabase
            .from('expert_picks')
            .delete()
            .eq('sport', sportShort)
            .lt('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

          const { error: picksError } = await supabase
            .from('expert_picks')
            .insert(expertPicks);
          if (picksError) console.error('Error inserting expert picks:', picksError);
          sportSummary.expertPicks = expertPicks.length;
        }
      } catch (e) {
        console.error(`Error scraping experts for ${sportKey}:`, e);
      }

      // Update poll schedule
      const now = new Date();
      await supabase
        .from('poll_schedule')
        .update({
          last_polled_at: now.toISOString(),
          next_poll_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          is_game_day: true,
        })
        .eq('sport_key', sportKey);

      summary[sportKey] = sportSummary;
    }

    // 3. Refresh materialized view
    try {
      await supabase.rpc('refresh_latest_odds');
    } catch (e) {
      console.error('Error refreshing latest_odds:', e);
    }

    // 4. Run analysis on latest odds
    const { data: latestOdds } = await supabase
      .from('latest_odds')
      .select('*');

    if (latestOdds && latestOdds.length > 0) {
      const typedOdds = latestOdds as unknown as LatestOdds[];

      // Arbitrage detection
      const arbs = findAllArbitrages(typedOdds);
      if (arbs.length > 0) {
        await supabase
          .from('arbitrage_opportunities')
          .update({ status: 'expired' })
          .eq('status', 'active');

        await supabase.from('arbitrage_opportunities').insert(
          arbs.map((a) => ({
            event_id: a.event_id,
            market_key: a.market_key,
            profit_margin: a.profit_margin,
            legs: a.legs,
            total_implied_probability: a.total_implied_probability,
            status: 'active',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          }))
        );
      }
      summary.arbitrageFound = arbs.length;

      // +EV detection
      const evs = findAllEvOpportunities(typedOdds);
      if (evs.length > 0) {
        await supabase
          .from('ev_opportunities')
          .update({ status: 'expired' })
          .eq('status', 'active');

        await supabase.from('ev_opportunities').insert(
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

      for (const arb of arbs.slice(0, 3)) {
        for (const leg of arb.legs) {
          recommendations.push({
            event_id: arb.event_id,
            type: 'arbitrage',
            market_key: arb.market_key,
            outcome_name: leg.outcome_name,
            bookmaker_key: leg.bookmaker,
            odds: leg.odds,
            reasoning: `Arbitraje: ${formatPct(arb.profit_margin)} ganancia garantizada. Apostar ${formatPct(leg.stake_pct)} en ${BOOKMAKERS[leg.bookmaker]?.name ?? leg.bookmaker}.`,
            confidence_score: Math.min(0.99, 0.9 + arb.profit_margin),
            valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          });
        }
      }

      for (const ev of evs.slice(0, 5)) {
        recommendations.push({
          event_id: ev.event_id,
          type: 'ev',
          market_key: ev.market_key,
          outcome_name: ev.outcome_name,
          bookmaker_key: ev.bookmaker_key,
          odds: ev.odds,
          reasoning: `Valor +EV: ${formatPct(ev.edge_pct)} ventaja. Odds ${formatOdds(ev.odds)} en ${BOOKMAKERS[ev.bookmaker_key]?.name ?? ev.bookmaker_key} vs justas ${formatOdds(ev.fair_odds)}.`,
          confidence_score: ev.confidence === 'alta' ? 0.85 : ev.confidence === 'media' ? 0.7 : 0.55,
          valid_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        });
      }

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
            reasoning: `Parlay en ${BOOKMAKERS[leg.bookmaker_key]?.name ?? leg.bookmaker_key}. Odds combinadas: +${parlay.combined_odds}. Ventaja: ${formatPct(parlay.combined_edge)}.`,
            confidence_score: 0.6,
            valid_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      if (recommendations.length > 0) {
        await supabase
          .from('recommendations')
          .delete()
          .lt('valid_until', new Date().toISOString());

        await supabase.from('recommendations').insert(recommendations);
      }
      summary.recommendations = recommendations.length;
    }

    // 5. Create simulated bets from top recommendations
    const { data: newRecs } = await supabase
      .from('recommendations')
      .select('*')
      .gte('valid_until', new Date().toISOString())
      .order('confidence_score', { ascending: false })
      .limit(5);

    if (newRecs && newRecs.length > 0) {
      // Check which events don't already have a simulated bet
      for (const rec of newRecs) {
        const { data: existingBet } = await supabase
          .from('simulated_bets')
          .select('id')
          .eq('event_id', rec.event_id)
          .eq('outcome_name', rec.outcome_name)
          .eq('market_key', rec.market_key)
          .limit(1);

        if (!existingBet || existingBet.length === 0) {
          await supabase.from('simulated_bets').insert({
            event_id: rec.event_id,
            market_key: rec.market_key,
            outcome_name: rec.outcome_name,
            bookmaker_key: rec.bookmaker_key,
            odds: rec.odds,
            stake: 100,
            source: rec.type,
            reasoning: rec.reasoning,
            result: 'pending',
          });
        }
      }
      summary.simulatedBetsCreated = newRecs.length;
    }

    // 6. Settle completed simulated bets
    const { data: pendingBets } = await supabase
      .from('simulated_bets')
      .select('*, events(completed, scores, home_team, away_team)')
      .eq('result', 'pending');

    if (pendingBets) {
      for (const bet of pendingBets) {
        const event = (bet as Record<string, unknown>).events as {
          completed: boolean;
          scores: { home: number; away: number } | null;
          home_team: string;
          away_team: string;
        } | null;

        if (!event?.completed || !event.scores) continue;

        // Determine if bet won based on market type
        let won: boolean | null = null;
        const homeScore = event.scores.home;
        const awayScore = event.scores.away;

        if (bet.market_key === 'h2h') {
          // Moneyline: did the picked team win?
          const pickedHome = bet.outcome_name === event.home_team;
          won = pickedHome ? homeScore > awayScore : awayScore > homeScore;
        } else if (bet.market_key === 'totals') {
          // Over/Under
          const total = homeScore + awayScore;
          // Get point from odds snapshots
          const { data: snapshot } = await supabase
            .from('odds_snapshots')
            .select('outcomes')
            .eq('event_id', bet.event_id)
            .eq('market_key', 'totals')
            .order('fetched_at', { ascending: false })
            .limit(1);

          if (snapshot?.[0]) {
            const outcomes = snapshot[0].outcomes as Array<{ name: string; point?: number }>;
            const line = outcomes[0]?.point ?? 0;
            if (bet.outcome_name === 'Over') {
              won = total > line;
            } else {
              won = total < line;
            }
          }
        }

        if (won !== null) {
          const decimal = bet.odds > 0 ? bet.odds / 100 : 100 / Math.abs(bet.odds);
          const profit = won ? bet.stake * decimal : -bet.stake;

          await supabase
            .from('simulated_bets')
            .update({
              result: won ? 'won' : 'lost',
              profit,
              settled_at: new Date().toISOString(),
            })
            .eq('id', bet.id);
        }
      }
      summary.betsSettled = pendingBets.filter(
        (b) => ((b as Record<string, unknown>).events as { completed: boolean } | null)?.completed
      ).length;
    }

    // 7. Expire old opportunities
    await supabase.rpc('expire_old_opportunities');

    summary.source = 'ESPN Core API + Covers + Reddit (sin API key)';

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
