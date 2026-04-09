import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchEspnScoreboard } from '@/lib/scrapers/espn';
import { fetchAllExpertPicks } from '@/lib/scrapers/experts';
import { fetchConsensusData, findOddsDiscrepancies } from '@/lib/scrapers/odds-sites';
import { findAllArbitrages } from '@/lib/analysis/arbitrage';
import { findAllEvOpportunities } from '@/lib/analysis/expected-value';
import { buildParlays } from '@/lib/analysis/parlay-builder';
import { detectLineMovements, detectSteamMoves } from '@/lib/analysis/line-movement';
import { generateRecommendations, type EngineInput } from '@/lib/analysis/recommendation-engine';
import type { LatestOdds, OddsSnapshot } from '@/types/odds';
import { fetchKalshiSportsMarkets } from '@/lib/scrapers/kalshi';
import { fetchNbaTeamStats, fetchMlbTeamStats } from '@/lib/scrapers/stats';
import { detectFatigue, computeHomeAdvantage, computePace, computeAltitude, computeCLV, detectStreak, computePlayoffMotivation, type FatigueSignal, type HomeAwaySignal, type PaceSignal, type AltitudeSignal, type CLVSignal, type StreakSignal, type PlayoffSignal } from '@/lib/analysis/advanced-signals';
import { fetchGameWeather } from '@/lib/scrapers/weather';
import { fetchPolymarketSports } from '@/lib/scrapers/polymarket';
import type { WeatherData } from '@/lib/scrapers/weather';
import { fetchOdds as fetchTheOddsApi } from '@/lib/odds-api/client';
import { logApiUsage, getRemainingCredits, canAffordRequest } from '@/lib/odds-api/budget-tracker';
import type { ExpertPick } from '@/lib/scrapers/experts';

const SPORT_KEYS = ['basketball_nba', 'baseball_mlb'];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const summary: Record<string, unknown> = {};

  try {
    // ═══ PHASE 1: DATA COLLECTION ═══
    for (const sportKey of SPORT_KEYS) {
      const ss: Record<string, unknown> = {};
      try {
        const { events, odds } = await fetchEspnScoreboard(sportKey);
        ss.events = events.length; ss.odds = odds.length;
        if (events.length > 0) {
          await supabase.from('events').upsert(
            events.map((e) => ({ id: e.id, sport_key: e.sport_key, commence_time: e.commence_time, home_team: e.home_team, away_team: e.away_team, completed: e.completed, scores: e.scores })),
            { onConflict: 'id' }
          );
        }
        if (odds.length > 0) {
          const t = new Date().toISOString();
          await supabase.from('odds_snapshots').insert(odds.map((o) => ({ event_id: o.event_id, bookmaker_key: o.bookmaker_key, market_key: o.market_key, outcomes: o.outcomes, fetched_at: t })));
        }
      } catch (e) { ss.error = String(e); }

      // 1b. The Odds API (6 bookmakers, 500 req/month free)
      if (process.env.ODDS_API_KEY) {
        try {
          const remaining = await getRemainingCredits(supabase);
          if (canAffordRequest(remaining, 3)) {
            const { events: oddsEvents, creditsUsed } = await fetchTheOddsApi(sportKey);
            await logApiUsage(supabase, `/sports/${sportKey}/odds`, creditsUsed, sportKey, ['h2h', 'spreads', 'totals']);
            const t = new Date().toISOString();
            const snaps: Array<{ event_id: string; bookmaker_key: string; market_key: string; outcomes: unknown; fetched_at: string }> = [];
            for (const ev of oddsEvents) {
              // Upsert event from Odds API
              await supabase.from('events').upsert({ id: ev.id, sport_key: ev.sport_key, commence_time: ev.commence_time, home_team: ev.home_team, away_team: ev.away_team }, { onConflict: 'id' });
              for (const bk of ev.bookmakers) {
                for (const mk of bk.markets) {
                  snaps.push({ event_id: ev.id, bookmaker_key: bk.key, market_key: mk.key, outcomes: mk.outcomes, fetched_at: t });
                }
              }
            }
            if (snaps.length > 0) await supabase.from('odds_snapshots').insert(snaps);
            ss.oddsApiEvents = oddsEvents.length;
            ss.oddsApiSnapshots = snaps.length;
            ss.oddsApiCredits = creditsUsed;
            ss.oddsApiRemaining = remaining - creditsUsed;
          } else {
            ss.oddsApiSkipped = `${remaining} credits remaining`;
          }
        } catch (e) { ss.oddsApiError = String(e); }
      }

      const sport = sportKey === 'basketball_nba' ? 'nba' : 'mlb';
      try {
        const picks = await fetchAllExpertPicks(sport as 'nba' | 'mlb');
        if (picks.length > 0) {
          await supabase.from('expert_picks').delete().eq('sport', sport).lt('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
          await supabase.from('expert_picks').insert(picks);
          ss.expertPicks = picks.length;
        }
      } catch { /* ok */ }

      await supabase.from('poll_schedule').update({ last_polled_at: new Date().toISOString(), next_poll_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), is_game_day: true }).eq('sport_key', sportKey);
      summary[sportKey] = ss;
    }

    // 1c. Scrape Kalshi/Robinhood prediction markets
    try {
      const kalshiMarkets = await fetchKalshiSportsMarkets();
      if (kalshiMarkets.length > 0) {
        await supabase.from('robinhood_contracts').delete().lt('scraped_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
        await supabase.from('robinhood_contracts').insert(
          kalshiMarkets.map((m) => ({
            ticker: m.ticker, event_ticker: m.event_ticker, title: m.title,
            subtitle: m.subtitle, yes_price: m.yes_price, no_price: m.no_price,
            volume: m.volume, open_interest: m.open_interest, legs: m.legs,
            sport: m.sport, implied_prob: m.implied_prob,
          }))
        );
        summary.robinhoodContracts = kalshiMarkets.length;
      }
    } catch (e) { summary.kalshiError = String(e); }

    try { await supabase.rpc('refresh_latest_odds'); } catch { /* ok */ }

    // ═══ PHASE 2: ANALYSIS ═══
    const { data: latestOdds } = await supabase.from('latest_odds').select('*');
    if (latestOdds && latestOdds.length > 0) {
      const typedOdds = latestOdds as unknown as LatestOdds[];

      const arbs = findAllArbitrages(typedOdds);
      if (arbs.length > 0) {
        await supabase.from('arbitrage_opportunities').update({ status: 'expired' }).eq('status', 'active');
        await supabase.from('arbitrage_opportunities').insert(arbs.map((a) => ({ event_id: a.event_id, market_key: a.market_key, profit_margin: a.profit_margin, legs: a.legs, total_implied_probability: a.total_implied_probability, status: 'active', expires_at: new Date(Date.now() + 3600000).toISOString() })));
      }
      summary.arbs = arbs.length;

      const evs = findAllEvOpportunities(typedOdds);
      if (evs.length > 0) {
        await supabase.from('ev_opportunities').update({ status: 'expired' }).eq('status', 'active');
        await supabase.from('ev_opportunities').insert(evs.map((e) => ({ event_id: e.event_id, market_key: e.market_key, outcome_name: e.outcome_name, bookmaker_key: e.bookmaker_key, odds: e.odds, fair_odds: e.fair_odds, edge_pct: e.edge_pct, kelly_fraction: e.kelly_fraction, confidence: e.confidence, status: 'active' })));
      }
      summary.evs = evs.length;

      const parlays = buildParlays(evs);

      // Line movement
      const ago30 = new Date(Date.now() - 1800000).toISOString();
      const { data: prev } = await supabase.from('odds_snapshots').select('*').lt('fetched_at', ago30).order('fetched_at', { ascending: false }).limit(500);
      const { data: curr } = await supabase.from('odds_snapshots').select('*').gte('fetched_at', ago30).limit(500);
      const lineMovements = detectLineMovements(curr as unknown as OddsSnapshot[] ?? [], prev as unknown as OddsSnapshot[] ?? []);
      const steamMoves = detectSteamMoves(lineMovements);
      summary.lineMovements = lineMovements.length;
      summary.steamMoves = steamMoves.length;

      // Consensus
      const allConsensus = [];
      for (const sk of SPORT_KEYS) { try { const { consensusPicks } = await fetchConsensusData(sk); allConsensus.push(...consensusPicks); } catch { /* ok */ } }

      // Discrepancies
      const scrapedOdds = (curr ?? []).map((s: Record<string, unknown>) => ({ event_id: s.event_id as string, bookmaker_key: s.bookmaker_key as string, bookmaker_name: s.bookmaker_key as string, market_key: s.market_key as string, outcomes: s.outcomes as Array<{ name: string; price: number; point?: number }> }));
      const discrepancies = findOddsDiscrepancies(scrapedOdds);

      // Expert picks
      const { data: allExperts } = await supabase.from('expert_picks').select('*').gte('scraped_at', new Date(Date.now() - 86400000).toISOString());
      const typedExperts = (allExperts ?? []) as unknown as ExpertPick[];

      // Event teams
      const { data: eventsData } = await supabase.from('events').select('id, home_team, away_team');
      const eventTeams = new Map<string, { home_team: string; away_team: string }>();
      for (const ev of eventsData ?? []) eventTeams.set(ev.id, { home_team: ev.home_team, away_team: ev.away_team });

      // Fetch Kalshi/Robinhood contracts from DB
      const { data: kalshiData } = await supabase.from('robinhood_contracts').select('*').gte('scraped_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
      const kalshiContracts = (kalshiData ?? []) as unknown as import('@/lib/scrapers/kalshi').KalshiContract[];

      // Fetch team stats for upcoming games
      const teamStats = new Map<string, { win_pct: number; avg_points?: number; recent_form?: string }>();
      for (const [, teams] of eventTeams) {
        for (const teamName of [teams.home_team, teams.away_team]) {
          if (teamStats.has(teamName)) continue;
          try {
            const nba = await fetchNbaTeamStats(teamName);
            if (nba) { teamStats.set(teamName, { win_pct: nba.win_pct, avg_points: nba.avg_points, recent_form: nba.recent_form }); continue; }
            const mlb = await fetchMlbTeamStats(teamName);
            if (mlb) { teamStats.set(teamName, { win_pct: mlb.win_pct }); }
          } catch { /* ok */ }
        }
      }
      summary.teamStats = teamStats.size;

      // Fetch weather for outdoor MLB games
      const weatherMap = new Map<string, WeatherData>();
      for (const [eventId, teams] of eventTeams) {
        if (!eventId.startsWith('espn_')) continue;
        try {
          const { data: ev } = await supabase.from('events').select('commence_time, sport_key').eq('id', eventId).single();
          if (ev?.sport_key === 'baseball_mlb') {
            const w = await fetchGameWeather(teams.home_team, ev.commence_time);
            if (w) weatherMap.set(eventId, w);
          }
        } catch { /* ok */ }
      }
      summary.weatherData = weatherMap.size;

      // Fetch Polymarket sports contracts
      let polyContracts: import('@/lib/scrapers/polymarket').PolyContract[] = [];
      try {
        polyContracts = await fetchPolymarketSports();
        summary.polymarket = polyContracts.length;
      } catch { /* ok */ }

      // Compute advanced signals (13-20)
      const fatigueSignals: FatigueSignal[] = [];
      const homeAwaySignals: HomeAwaySignal[] = [];
      const paceSignals: PaceSignal[] = [];
      const altitudeSignals: AltitudeSignal[] = [];
      const clvSignals: CLVSignal[] = [];
      const streakSignals: StreakSignal[] = [];
      const playoffSignals: PlayoffSignal[] = [];

      for (const [eventId, teams] of eventTeams) {
        const { data: ev } = await supabase.from('events').select('commence_time, sport_key').eq('id', eventId).single();
        if (!ev) continue;

        // Home/Away
        homeAwaySignals.push(...computeHomeAdvantage(eventId, teams.home_team, teams.away_team, ev.sport_key));

        // Pace (NBA only)
        if (ev.sport_key === 'basketball_nba') {
          const pace = computePace(eventId, teams.home_team, teams.away_team);
          if (pace) paceSignals.push(pace);
        }

        // Altitude (MLB only)
        if (ev.sport_key === 'baseball_mlb') {
          altitudeSignals.push(computeAltitude(eventId, teams.home_team));
        }

        // Fatigue - check recent games for each team
        for (const teamName of [teams.home_team, teams.away_team]) {
          const { data: teamGames } = await supabase.from('events').select('commence_time, completed')
            .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)
            .order('commence_time', { ascending: false }).limit(5);
          if (teamGames) {
            fatigueSignals.push(detectFatigue(eventId, teamName, teamGames, ev.commence_time));
          }
        }

        // Streaks
        for (const teamName of [teams.home_team, teams.away_team]) {
          const { data: recentGames } = await supabase.from('events').select('home_team, scores, completed')
            .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)
            .eq('completed', true)
            .order('commence_time', { ascending: false }).limit(10);
          if (recentGames && recentGames.length >= 3) {
            const results = recentGames.map((g) => {
              const scores = g.scores as { home: number; away: number } | null;
              if (!scores) return { won: false };
              const isHome = g.home_team === teamName;
              return { won: isHome ? scores.home > scores.away : scores.away > scores.home };
            });
            streakSignals.push(detectStreak(eventId, teamName, results));
          }
        }

        // Playoff motivation
        for (const teamName of [teams.home_team, teams.away_team]) {
          const stats = teamStats.get(teamName);
          if (stats) {
            playoffSignals.push(computePlayoffMotivation(eventId, teamName, stats.win_pct, 10, stats.win_pct > 0.5));
          }
        }

        // CLV - check line movement for this event
        const { data: eventSnaps } = await supabase.from('odds_snapshots').select('outcomes, fetched_at, market_key')
          .eq('event_id', eventId).eq('market_key', 'h2h').order('fetched_at', { ascending: true }).limit(10);
        if (eventSnaps && eventSnaps.length >= 2) {
          for (const teamName of [teams.home_team, teams.away_team]) {
            const teamOdds = eventSnaps.map((s) => {
              const outcomes = s.outcomes as Array<{ name: string; price: number }>;
              const o = outcomes.find((x) => x.name === teamName);
              return o ? { odds: o.price, fetched_at: s.fetched_at as string } : null;
            }).filter((x): x is { odds: number; fetched_at: string } => x !== null);
            const clv = computeCLV(eventId, 'h2h', teamName, teamOdds);
            if (clv) clvSignals.push(clv);
          }
        }
      }

      summary.advancedSignals = {
        fatigue: fatigueSignals.filter((f) => f.advantage !== 'neutral').length,
        homeAway: homeAwaySignals.length,
        pace: paceSignals.length,
        altitude: altitudeSignals.filter((a) => a.park_factor !== 1.0).length,
        clv: clvSignals.length,
        streaks: streakSignals.filter((s) => s.streak_type !== 'neutral').length,
        playoff: playoffSignals.filter((p) => p.motivation !== 'medium').length,
      };

      // ═══ PHASE 3: CORRELATION ENGINE (20 signals) ═══
      const engineRecs = generateRecommendations({ arbs, evs, expertPicks: typedExperts, lineMovements, steamMoves, consensus: allConsensus, discrepancies, parlays, kalshiContracts, teamStats, weather: weatherMap, polymarket: polyContracts, fatigue: fatigueSignals, homeAway: homeAwaySignals, pace: paceSignals, altitude: altitudeSignals, clv: clvSignals, streaks: streakSignals, playoff: playoffSignals, eventTeams } as EngineInput);
      summary.engineSignals = { arbs: arbs.length, evs: evs.length, experts: typedExperts.length, lineMovements: lineMovements.length, steamMoves: steamMoves.length, consensus: allConsensus.length, discrepancies: discrepancies.length, parlays: parlays.length, robinhood: kalshiContracts.length };

      if (engineRecs.length > 0) {
        await supabase.from('recommendations').delete().lt('valid_until', new Date().toISOString());
        await supabase.from('recommendations').insert(
          engineRecs.filter((r) => r.event_id).map((r) => ({
            event_id: r.event_id, type: r.type === 'steam' || r.type === 'expert' ? 'value' : r.type,
            market_key: r.market_key, outcome_name: r.outcome_name, bookmaker_key: r.bookmaker_key,
            odds: r.odds, reasoning: r.reasoning, confidence_score: r.confidence_score, valid_until: r.valid_until,
          }))
        );
      }
      summary.recommendations = engineRecs.length;
    }

    // ═══ PHASE 4: SIMULATED BETS (1 per game, moneyline only) ═══
    const { data: allRecs } = await supabase.from('recommendations').select('*')
      .eq('market_key', 'h2h') // Only moneyline (who wins)
      .gte('valid_until', new Date().toISOString())
      .order('confidence_score', { ascending: false });
    if (allRecs && allRecs.length > 0) {
      // Best moneyline rec per event (1 bet per game)
      const bestPerEvent = new Map<string, typeof allRecs[0]>();
      for (const rec of allRecs) {
        if (rec.event_id && !bestPerEvent.has(rec.event_id)) {
          bestPerEvent.set(rec.event_id, rec);
        }
      }
      let created = 0;
      for (const [eventId, rec] of bestPerEvent) {
        // Check no existing bet for this event (any market)
        const { data: ex } = await supabase.from('simulated_bets').select('id').eq('event_id', eventId).limit(1);
        if (!ex || ex.length === 0) {
          await supabase.from('simulated_bets').insert({
            event_id: rec.event_id, market_key: 'h2h',
            outcome_name: rec.outcome_name, bookmaker_key: rec.bookmaker_key,
            odds: rec.odds, stake: 100, source: rec.type,
            reasoning: rec.reasoning, result: 'pending',
          });
          created++;
        }
      }
      summary.betsCreated = created;
    }

    // Settle bets
    const { data: pending } = await supabase.from('simulated_bets').select('*, events(completed, scores, home_team, away_team)').eq('result', 'pending');
    if (pending) {
      let settled = 0;
      for (const bet of pending) {
        const ev = (bet as Record<string, unknown>).events as { completed: boolean; scores: { home: number; away: number } | null; home_team: string; away_team: string } | null;
        if (!ev?.completed || !ev.scores) continue;
        let won: boolean | null = null;
        const { home, away } = ev.scores;
        if (bet.market_key === 'h2h') { won = bet.outcome_name === ev.home_team ? home > away : away > home; }
        else if (bet.market_key === 'totals') {
          const { data: snap } = await supabase.from('odds_snapshots').select('outcomes').eq('event_id', bet.event_id).eq('market_key', 'totals').order('fetched_at', { ascending: false }).limit(1);
          if (snap?.[0]) { const line = (snap[0].outcomes as Array<{ point?: number }>)[0]?.point ?? 0; won = bet.outcome_name === 'Over' ? home + away > line : home + away < line; if (home + away === line) won = null; }
        } else if (bet.market_key === 'spreads') {
          const { data: snap } = await supabase.from('odds_snapshots').select('outcomes').eq('event_id', bet.event_id).eq('market_key', 'spreads').order('fetched_at', { ascending: false }).limit(1);
          if (snap?.[0]) { const o = (snap[0].outcomes as Array<{ name: string; point?: number }>).find((x) => x.name === bet.outcome_name); if (o?.point != null) { const isHome = bet.outcome_name === ev.home_team; const adj = (isHome ? home : away) + o.point; won = adj > (isHome ? away : home); if (adj === (isHome ? away : home)) won = null; } }
        }
        if (won !== null) {
          const dec = bet.odds > 0 ? bet.odds / 100 : 100 / Math.abs(bet.odds);
          await supabase.from('simulated_bets').update({ result: won ? 'won' : 'lost', profit: won ? bet.stake * dec : -bet.stake, settled_at: new Date().toISOString() }).eq('id', bet.id);
          settled++;
        } else if (won === null && ev.completed) {
          await supabase.from('simulated_bets').update({ result: 'push', profit: 0, settled_at: new Date().toISOString() }).eq('id', bet.id);
          settled++;
        }
      }
      summary.settled = settled;
    }

    await supabase.rpc('expire_old_opportunities');
    // Send push notification if we have new high-confidence recommendations
    const { data: topRec } = await supabase.from('recommendations').select('*').gte('valid_until', new Date().toISOString()).order('confidence_score', { ascending: false }).limit(1);
    if (topRec?.[0] && (topRec[0].confidence_score as number) > 0.5) {
      try {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://apuestazo.vercel.app';
        await fetch(`${baseUrl}/api/push/send`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Apuestazo: ${summary.recommendations ?? 0} recomendaciones`,
            body: `${topRec[0].outcome_name} - ${(topRec[0].confidence_score as number * 100).toFixed(0)}% confianza`,
            url: '/simulaciones',
          }),
        });
      } catch { /* ok */ }
    }

    summary.source = 'Correlation Engine (11 signals): ESPN + Odds API + Kalshi + Polymarket + Reddit + Covers + Weather + Stats';

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
