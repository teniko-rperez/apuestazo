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
import { detectFatigue, computeHomeAdvantage, computePace, computeAltitude, computeCLV, detectStreak, computePlayoffMotivation, computeInjuryAdvantage, type FatigueSignal, type HomeAwaySignal, type PaceSignal, type AltitudeSignal, type CLVSignal, type StreakSignal, type PlayoffSignal, type InjurySignal } from '@/lib/analysis/advanced-signals';
import { fetchAllInjuries } from '@/lib/scrapers/injuries';
import type { LearnedConfig } from '@/lib/analysis/learning-engine';
// Learning runs daily via /api/cron/learn
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
    // Load the latest learning history to apply learned weights & thresholds
    let learnedConfig: LearnedConfig | null = null;
    const { data: latestLearning } = await supabase
      .from('learning_history')
      .select('config')
      .order('created_at', { ascending: false })
      .limit(1);
    if (latestLearning?.[0]?.config) {
      learnedConfig = latestLearning[0].config as LearnedConfig;
    }

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
        // Cross-update: sync ESPN scores to Odds API events (different IDs, same games)
        const completedEspn = events.filter((e) => e.completed && e.scores);
        if (completedEspn.length > 0) {
          // Get all non-ESPN incomplete events
          const { data: oddsApiEvents } = await supabase.from('events')
            .select('id, home_team, away_team')
            .eq('completed', false)
            .not('id', 'like', 'espn_%');

          let crossCount = 0;
          for (const espnEv of completedEspn) {
            // Fuzzy match: check if last word of team name matches
            const espnHomeLast = espnEv.home_team.split(' ').pop()?.toLowerCase() ?? '';
            const espnAwayLast = espnEv.away_team.split(' ').pop()?.toLowerCase() ?? '';

            for (const oaEv of oddsApiEvents ?? []) {
              const oaHomeLast = oaEv.home_team.split(' ').pop()?.toLowerCase() ?? '';
              const oaAwayLast = oaEv.away_team.split(' ').pop()?.toLowerCase() ?? '';

              if (espnHomeLast === oaHomeLast && espnAwayLast === oaAwayLast) {
                await supabase.from('events').update({ completed: true, scores: espnEv.scores }).eq('id', oaEv.id);
                crossCount++;
              }
            }
          }
          ss.crossUpdated = crossCount;
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
        ss.expertPicksFound = picks.length;
        if (picks.length > 0) {
          await supabase.from('expert_picks').delete().eq('sport', sport).lt('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
          const { error: insertErr } = await supabase.from('expert_picks').insert(picks);
          if (insertErr) ss.expertInsertError = insertErr.message;
          else ss.expertPicks = picks.length;
        }
      } catch (e) { ss.expertError = String(e); }

      // Fallback: create expert picks from Kalshi contracts already in DB
      if (!ss.expertPicks) {
        try {
          const { data: kalshi } = await supabase.from('robinhood_contracts').select('*').eq('sport', sport).gte('scraped_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()).limit(10);
          if (kalshi && kalshi.length > 0) {
            const now = new Date().toISOString();
            const kalshiPicks = kalshi.map((c: Record<string, unknown>) => ({
              expert_name: 'Kalshi/Robinhood', source: 'Robinhood/Kalshi', source_url: 'https://kalshi.com',
              sport, pick_type: 'parlay',
              pick_description: ((c.title as string) ?? '').slice(0, 200),
              confidence: 'media' as const,
              record: `Contrato Kalshi`, profit_units: null, scraped_at: now,
            }));
            if (kalshiPicks.length > 0) {
              await supabase.from('expert_picks').insert(kalshiPicks);
              ss.expertPicksKalshi = kalshiPicks.length;
            }
          }
        } catch { /* ok */ }
      }

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

      // Fetch team stats - only for today's upcoming games (limit API calls)
      const teamStats = new Map<string, { win_pct: number; avg_points?: number; recent_form?: string }>();
      const upcomingEvents = [...eventTeams.entries()].slice(0, 20); // Max 20 events
      const uniqueTeams = new Set<string>();
      for (const [, t] of upcomingEvents) { uniqueTeams.add(t.home_team); uniqueTeams.add(t.away_team); }

      // Batch: fetch MLB standings once (covers all MLB teams)
      try {
        const mlbRes = await fetch('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason', { signal: AbortSignal.timeout(3000) });
        if (mlbRes.ok) {
          const mlbData = await mlbRes.json() as { records: Array<{ teamRecords: Array<{ team: { name: string }; wins: number; losses: number; winningPercentage: string }> }> };
          for (const rec of mlbData.records ?? []) {
            for (const t of rec.teamRecords ?? []) {
              if (uniqueTeams.has(t.team.name)) {
                teamStats.set(t.team.name, { win_pct: parseFloat(t.winningPercentage) || t.wins / (t.wins + t.losses) });
              }
            }
          }
        }
      } catch { /* ok */ }

      // NBA stats: only fetch for teams not already covered (max 10 API calls)
      let nbaCallCount = 0;
      for (const teamName of uniqueTeams) {
        if (teamStats.has(teamName) || nbaCallCount >= 10) continue;
        try {
          const nba = await fetchNbaTeamStats(teamName);
          if (nba) { teamStats.set(teamName, { win_pct: nba.win_pct, avg_points: nba.avg_points, recent_form: nba.recent_form }); }
          nbaCallCount++;
        } catch { /* ok */ }
      }
      summary.teamStats = teamStats.size;

      // Fetch weather for outdoor MLB games (only next 6 hours to limit API calls)
      const weatherMap = new Map<string, WeatherData>();
      const sixHoursFromNow = Date.now() + 6 * 60 * 60 * 1000;
      const { data: upcomingMlb } = await supabase.from('events').select('id, home_team, commence_time')
        .eq('sport_key', 'baseball_mlb').eq('completed', false)
        .lte('commence_time', new Date(sixHoursFromNow).toISOString())
        .gte('commence_time', new Date().toISOString()).limit(10);
      for (const mlbEv of upcomingMlb ?? []) {
        try {
          const w = await fetchGameWeather(mlbEv.home_team, mlbEv.commence_time);
          if (w) weatherMap.set(mlbEv.id, w);
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
      const injurySignals: InjurySignal[] = [];

      // Fetch injury reports
      const allInjuryReports = await fetchAllInjuries();
      const injuryMap = new Map<string, { impact: string; star_out_count: number; total_out_count: number; description: string }>();
      for (const report of allInjuryReports) {
        injuryMap.set(report.team_name, {
          impact: report.impact,
          star_out_count: report.star_out_count,
          total_out_count: report.total_out_count,
          description: report.description,
        });
      }

      // Batch fetch all events with sport_key for advanced signals
      const { data: allEventsForSignals } = await supabase.from('events').select('id, commence_time, sport_key, home_team, away_team, completed, scores').limit(200);
      const eventsMap = new Map<string, { commence_time: string; sport_key: string; completed: boolean }>();
      const allEventsList = allEventsForSignals ?? [];
      for (const e of allEventsList) eventsMap.set(e.id, { commence_time: e.commence_time, sport_key: e.sport_key, completed: e.completed });

      for (const [eventId, teams] of eventTeams) {
        const ev = eventsMap.get(eventId);
        if (!ev) continue;

        // Home/Away
        homeAwaySignals.push(...computeHomeAdvantage(eventId, teams.home_team, teams.away_team, ev.sport_key));

        // Injuries
        injurySignals.push(...computeInjuryAdvantage(eventId, teams.home_team, teams.away_team, injuryMap));

        // Pace (NBA only)
        if (ev.sport_key === 'basketball_nba') {
          const pace = computePace(eventId, teams.home_team, teams.away_team);
          if (pace) paceSignals.push(pace);
        }

        // Altitude (MLB only)
        if (ev.sport_key === 'baseball_mlb') {
          altitudeSignals.push(computeAltitude(eventId, teams.home_team));
        }

        // Fatigue - use cached events list instead of per-team query
        for (const teamName of [teams.home_team, teams.away_team]) {
          const teamGames = allEventsList
            .filter((g) => (g.home_team === teamName || g.away_team === teamName) && g.completed)
            .sort((a, b) => new Date(b.commence_time).getTime() - new Date(a.commence_time).getTime())
            .slice(0, 5);
          if (teamGames.length > 0) {
            fatigueSignals.push(detectFatigue(eventId, teamName, teamGames, ev.commence_time));
          }
        }

        // Streaks - use cached events
        for (const teamName of [teams.home_team, teams.away_team]) {
          const recentGames = allEventsList
            .filter((g) => (g.home_team === teamName || g.away_team === teamName) && g.completed && g.scores)
            .sort((a, b) => new Date(b.commence_time).getTime() - new Date(a.commence_time).getTime())
            .slice(0, 10);
          if (recentGames.length >= 3) {
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
        injuries: injurySignals.filter((i) => i.advantage !== 'neutral').length,
      };

      // ═══ PHASE 3: CORRELATION ENGINE (with learned config) ═══
      if (learnedConfig) {
        (summary as Record<string, unknown>).learnedConfig = {
          win_rate: learnedConfig.overall_win_rate,
          min_confidence: learnedConfig.min_confidence,
          min_signals: learnedConfig.min_signals,
          avoid_signals: learnedConfig.avoid_signals,
        };
      }

      const engineRecs = generateRecommendations({ arbs, evs, expertPicks: typedExperts, lineMovements, steamMoves, consensus: allConsensus, discrepancies, parlays, kalshiContracts, teamStats, weather: weatherMap, polymarket: polyContracts, fatigue: fatigueSignals, homeAway: homeAwaySignals, pace: paceSignals, altitude: altitudeSignals, clv: clvSignals, streaks: streakSignals, playoff: playoffSignals, injuries: injurySignals, eventTeams } as EngineInput, learnedConfig);
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

    // ═══ PHASE 3.5: MONITOR & CANCEL BETS (pre-game only) ═══
    const { data: pendingBets15 } = await supabase.from('simulated_bets')
      .select('id, event_id, outcome_name, reasoning, odds')
      .eq('result', 'pending');

    let cancelled = 0;
    if (pendingBets15 && pendingBets15.length > 0) {
      // Batch load all needed data to avoid N+1 queries
      const pendingEventIds = [...new Set(pendingBets15.map((b) => b.event_id as string))];
      const { data: batchEvents } = await supabase.from('events').select('id, commence_time').in('id', pendingEventIds);
      const eventTimeMap = new Map((batchEvents ?? []).map((e) => [e.id as string, e.commence_time as string]));

      const { data: batchOdds } = await supabase.from('latest_odds').select('event_id, outcomes').eq('market_key', 'h2h').in('event_id', pendingEventIds);
      const oddsMap = new Map((batchOdds ?? []).map((o) => [o.event_id as string, (o as Record<string, unknown>).outcomes as Array<{ name: string; price: number }>]));

      const { data: batchRecs } = await supabase.from('recommendations').select('event_id, outcome_name, confidence_score')
        .eq('market_key', 'h2h').in('event_id', pendingEventIds)
        .gte('valid_until', new Date().toISOString());
      const recMap = new Map<string, { outcome_name: string; confidence_score: number }>();
      for (const rec of (batchRecs ?? []) as Array<Record<string, unknown>>) {
        const eid = rec.event_id as string;
        const conf = rec.confidence_score as number;
        if (!recMap.has(eid) || conf > (recMap.get(eid)?.confidence_score ?? 0)) {
          recMap.set(eid, { outcome_name: rec.outcome_name as string, confidence_score: conf });
        }
      }

      for (const bet of pendingBets15) {
        const commenceTime = eventTimeMap.get(bet.event_id as string);
        if (!commenceTime) continue;
        if (new Date(commenceTime).getTime() <= Date.now()) continue; // Game started, freeze

        // Check if the favorite changed (odds shifted)
        const outcomes = oddsMap.get(bet.event_id as string);
        if (outcomes && outcomes.length >= 2) {
          const currentFav = outcomes.reduce((a, b) => a.price < b.price ? a : b);

          // Cancel if favorite flipped to the other team
          if (currentFav.name !== bet.outcome_name && currentFav.price < -120) {
            await supabase.from('simulated_bets').update({
              result: 'cancelled', profit: 0, settled_at: new Date().toISOString(),
              reasoning: (bet.reasoning ?? '') + ` [CANCELADA: favorito cambio a ${currentFav.name} (${currentFav.price})]`,
            }).eq('id', bet.id);
            cancelled++;
            continue;
          }

          // Cancel if our pick's odds got much worse (moved from favorite to underdog)
          const ourOutcome = outcomes.find((o) => o.name === bet.outcome_name);
          if (ourOutcome && ourOutcome.price > 0 && (bet.odds as number) < 0) {
            await supabase.from('simulated_bets').update({
              result: 'cancelled', profit: 0, settled_at: new Date().toISOString(),
              reasoning: (bet.reasoning ?? '') + ` [CANCELADA: odds cambiaron de ${bet.odds} a +${ourOutcome.price} (ya no es favorito)]`,
            }).eq('id', bet.id);
            cancelled++;
            continue;
          }
        }

        // Check recommendation confidence
        const rec = recMap.get(bet.event_id as string);
        if (rec && rec.confidence_score < 0.10) {
          await supabase.from('simulated_bets').update({
            result: 'cancelled', profit: 0, settled_at: new Date().toISOString(),
            reasoning: (bet.reasoning ?? '') + ` [CANCELADA: confianza bajo a ${(rec.confidence_score * 100).toFixed(0)}%]`,
          }).eq('id', bet.id);
          cancelled++;
        }
      }
    }
    summary.betsCancelled = cancelled;

    // ═══ PHASE 4: SIMULATED BETS (always bet on favorite, 1 per game) ═══
    // Get all h2h odds to find the favorite per event
    const { data: latestH2h } = await supabase.from('latest_odds').select('*').eq('market_key', 'h2h');
    const favoritePerEvent = new Map<string, { team: string; odds: number; bookmaker: string }>();

    for (const row of latestH2h ?? []) {
      const outcomes = (row as Record<string, unknown>).outcomes as Array<{ name: string; price: number }>;
      const eventId = (row as Record<string, unknown>).event_id as string;
      if (!outcomes || outcomes.length < 2) continue;

      // Favorite = lowest (most negative) American odds
      const sorted = [...outcomes].sort((a, b) => a.price - b.price);
      const fav = sorted[0]; // most negative = biggest favorite
      if (fav.price >= 0) continue; // skip if no clear favorite

      const existing = favoritePerEvent.get(eventId);
      if (!existing || fav.price < existing.odds) {
        favoritePerEvent.set(eventId, {
          team: fav.name,
          odds: fav.price,
          bookmaker: (row as Record<string, unknown>).bookmaker_key as string,
        });
      }
    }

    // Get recommendations for reasoning/confidence
    const { data: allRecs } = await supabase.from('recommendations').select('*')
      .eq('market_key', 'h2h').neq('odds', 0)
      .gte('valid_until', new Date().toISOString())
      .order('confidence_score', { ascending: false });

    const recByEvent = new Map<string, Record<string, unknown>>();
    for (const rec of (allRecs ?? []) as Array<Record<string, unknown>>) {
      if (rec.event_id && !recByEvent.has(rec.event_id as string)) recByEvent.set(rec.event_id as string, rec);
    }

    // Batch load events and existing bets to avoid N+1
    const favEventIds = [...favoritePerEvent.keys()];
    const { data: batchFavEvents } = await supabase.from('events').select('id, commence_time, completed').in('id', favEventIds);
    const favEventMap = new Map((batchFavEvents ?? []).map((e) => [e.id as string, e as Record<string, unknown>]));

    const { data: batchExisting } = await supabase.from('simulated_bets').select('id, event_id, result').in('event_id', favEventIds);
    const existingBetMap = new Map<string, { id: number; result: string }>();
    for (const b of (batchExisting ?? []) as Array<Record<string, unknown>>) {
      if (!existingBetMap.has(b.event_id as string)) {
        existingBetMap.set(b.event_id as string, { id: b.id as number, result: b.result as string });
      }
    }

    const lcMaxOdds = learnedConfig?.max_odds ?? 500;
    const lcMinOdds = learnedConfig?.min_odds ?? -800;
    const lcMinConf = learnedConfig?.min_confidence ?? 0.12;

    let created = 0;
    for (const [eventId, fav] of favoritePerEvent) {
      // Only games not started
      const eventData = favEventMap.get(eventId);
      if (!eventData || eventData.completed) continue;
      if (new Date(eventData.commence_time as string).getTime() <= Date.now()) continue;

      // Skip if odds too extreme (use learned thresholds or defaults)
      if (fav.odds < lcMinOdds) continue;
      if (fav.odds > 0 && fav.odds > lcMaxOdds) continue;

      // Build reasoning from recommendation if available
      const rec = recByEvent.get(eventId);
      const reasoning = rec
        ? (rec.reasoning as string)
        : `Favorito del mercado con odds ${fav.odds}. Apuesta basada en linea de apertura.`;
      const confidence = rec ? (rec.confidence_score as number) : 0.50;

      // Skip if below learned minimum confidence
      if (confidence < lcMinConf) continue;

      const ex = existingBetMap.get(eventId);
      if (!ex) {
        await supabase.from('simulated_bets').insert({
          event_id: eventId, market_key: 'h2h',
          outcome_name: fav.team, bookmaker_key: fav.bookmaker,
          odds: fav.odds, stake: 50, source: 'favorite',
          reasoning, result: 'pending',
        });
        created++;
      } else if (ex.result === 'pending') {
        // Update if better favorite found or recommendation changed
        await supabase.from('simulated_bets').update({
          outcome_name: fav.team, bookmaker_key: fav.bookmaker,
          odds: fav.odds, source: 'favorite', reasoning,
        }).eq('event_id', eventId).eq('result', 'pending');
      }
    }
    summary.betsCreated = created;

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

    // ═══ PHASE 5: INLINE LEARNING (learn after every settlement) ═══
    if ((summary as Record<string, unknown>).settled && ((summary as Record<string, unknown>).settled as number) > 0) {
      try {
        const { data: allSettled } = await supabase
          .from('simulated_bets')
          .select('result, profit, reasoning, odds, outcome_name, events(home_team)')
          .in('result', ['won', 'lost', 'push'])
          .limit(1000);
        if (allSettled && allSettled.length >= 3) {
          const { learnFromHistory } = await import('@/lib/analysis/learning-engine');
          const learningInput = (allSettled ?? []).map((b: Record<string, unknown>) => ({
            result: b.result as 'won' | 'lost' | 'push',
            profit: (b.profit as number) ?? 0,
            reasoning: (b.reasoning as string) ?? '',
            odds: b.odds as number | undefined,
            outcome_name: b.outcome_name as string | undefined,
            home_team: ((b.events as Record<string, unknown>)?.home_team as string) ?? undefined,
          }));
          const newConfig = learnFromHistory(learningInput);
          await supabase.from('learning_history').insert({
            config: { ...newConfig, loss_analysis: newConfig.loss_analysis.slice(0, 10) },
            signal_changes: {},
            bets_analyzed: newConfig.total_bets_analyzed,
            win_rate: newConfig.overall_win_rate,
          });
          (summary as Record<string, unknown>).inlineLearning = {
            win_rate: `${(newConfig.overall_win_rate * 100).toFixed(1)}%`,
            adjustments: newConfig.adjustments_made.length,
          };
        }
      } catch { /* learning is non-critical */ }
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
