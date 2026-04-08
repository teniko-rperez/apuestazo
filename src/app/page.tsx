"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useArbitrageOpportunities, useEvOpportunities } from "@/hooks/use-arbitrage";
import { useEvents, useSportOdds } from "@/hooks/use-odds";
import { BOOKMAKERS } from "@/lib/constants";
import { formatOdds } from "@/lib/analysis/implied-probability";
import type { GameEvent } from "@/types/event";
import type { LatestOdds, Outcome } from "@/types/odds";
import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";

/* ─── Game Row ─── */
function GameRow({ event, odds }: { event: GameEvent; odds: LatestOdds[] }) {
  const h2h = odds.filter((o) => o.event_id === event.id && o.market_key === "h2h");

  function best(team: string) {
    let b: { price: number; book: string } | null = null;
    for (const r of h2h) {
      const o = (r.outcomes as Outcome[]).find((x) => x.name === team);
      if (o && (!b || o.price > b.price)) b = { price: o.price, book: r.bookmaker_key };
    }
    return b;
  }

  const ho = best(event.home_team);
  const ao = best(event.away_team);
  const time = new Date(event.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
  const path = event.sport_key === "basketball_nba" ? "nba" : "mlb";

  return (
    <Link href={`/${path}/${event.id}`}>
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-border/50 active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {event.sport_key === "basketball_nba" ? "NBA" : "MLB"}
          </span>
          {event.completed ? (
            <Badge className="bg-gray-100 text-gray-500 text-[10px] h-5 px-1.5 font-semibold">FINAL</Badge>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium">{time}</span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-800 truncate flex-1">{event.away_team}</span>
            {event.scores && <span className="text-[13px] font-bold text-gray-800 mx-2">{event.scores.away}</span>}
            {ao && <span className="text-[13px] font-bold text-orange-500 font-mono ml-1">{formatOdds(ao.price)}</span>}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-[13px] font-medium text-gray-800 truncate">{event.home_team}</span>
              <span className="text-[8px] text-blue-500 font-bold">HOME</span>
            </div>
            {event.scores && <span className="text-[13px] font-bold text-gray-800 mx-2">{event.scores.home}</span>}
            {ho && <span className="text-[13px] font-bold text-orange-500 font-mono ml-1">{formatOdds(ho.price)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Rec Card ─── */
function RecCard({ rec }: { rec: Record<string, unknown> }) {
  const ev = rec.events as { home_team: string; away_team: string } | null;
  const conf = rec.confidence_score as number;
  const type = rec.type as string;

  const typeLabel = type === "arbitrage" ? "ARB" : type === "ev" ? "+EV" : "VALUE";
  const typeBg = type === "arbitrage" ? "bg-yellow-100 text-yellow-700" : type === "ev" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-600";

  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-1.5">
        <Badge className={`${typeBg} text-[10px] h-5 px-1.5 font-bold`}>{typeLabel}</Badge>
        <span className="text-[11px] font-bold text-blue-600">{Math.round(conf * 100)}%</span>
      </div>
      <p className="text-[11px] text-gray-400">{ev ? `${ev.away_team} @ ${ev.home_team}` : ""}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[13px] font-semibold text-gray-800">{rec.outcome_name as string}</span>
        <span className="text-[14px] font-bold text-orange-500 font-mono">{formatOdds(rec.odds as number)}</span>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{rec.reasoning as string}</p>
    </div>
  );
}

/* ─── Sim Bet Row ─── */
function SimRow({ bet }: { bet: Record<string, unknown> }) {
  const result = bet.result as string;
  const profit = bet.profit as number | null;
  const ev = bet.events as { home_team: string; away_team: string } | null;

  const rColor = result === "won" ? "text-green-600" : result === "lost" ? "text-red-500" : "text-blue-500";
  const rBg = result === "won" ? "bg-green-50" : result === "lost" ? "bg-red-50" : "bg-blue-50";

  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-border/50 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full ${rBg} flex items-center justify-center shrink-0`}>
        <span className={`text-[11px] font-black ${rColor}`}>
          {result === "won" ? "W" : result === "lost" ? "L" : "..."}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 truncate">{ev ? `${ev.away_team} @ ${ev.home_team}` : ""}</p>
        <p className="text-[12px] font-semibold text-gray-800 truncate">{bet.outcome_name as string}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-bold font-mono text-gray-600">{formatOdds(bet.odds as number)}</p>
        {profit != null && (
          <p className={`text-[12px] font-bold font-mono ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
            {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Section ─── */
function Section({ title, count, href, children }: { title: string; count?: number; href?: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">
          {title} {count != null && count > 0 && <span className="text-orange-500 normal-case">({count})</span>}
        </h2>
        {href && <Link href={href} className="text-[11px] text-blue-600 font-semibold">Ver todo</Link>}
      </div>
      {children}
    </div>
  );
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const { data: nbaEvents, isLoading: l1 } = useEvents("basketball_nba");
  const { data: mlbEvents, isLoading: l2 } = useEvents("baseball_mlb");
  const { data: nbaOdds } = useSportOdds("basketball_nba");
  const { data: mlbOdds } = useSportOdds("baseball_mlb");
  const { data: recs } = useRecommendations(undefined, 5);
  const { data: arbs } = useArbitrageOpportunities();
  const { data: evs } = useEvOpportunities();

  const { data: simBets } = useSWR("sim-home", async () => {
    const s = getClient();
    const { data } = await s.from("simulated_bets").select("*, events(home_team, away_team, scores)").order("placed_at", { ascending: false }).limit(5);
    return data ?? [];
  });


  const bets = (simBets ?? []) as Array<Record<string, unknown>>;
  const totalProfit = bets.reduce((s, b) => s + ((b.profit as number) ?? 0), 0);
  const wonCount = bets.filter((b) => b.result === "won").length;
  const settledCount = bets.filter((b) => b.result !== "pending").length;

  const allEvents = [...(nbaEvents ?? []), ...(mlbEvents ?? [])].sort(
    (a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
  );
  const allOdds = [...(nbaOdds ?? []), ...(mlbOdds ?? [])];

  return (
    <div>
      {/* Quick Stats Strip */}
      <div className="grid grid-cols-4 gap-1.5 lg:gap-3 mt-1">
        {[
          { label: "ARB", value: arbs?.length ?? 0, color: "text-yellow-600" },
          { label: "+EV", value: evs?.length ?? 0, color: "text-blue-600" },
          { label: "W/L", value: `${wonCount}/${settledCount}`, color: "text-gray-800" },
          { label: "P/L", value: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(0)}`, color: totalProfit >= 0 ? "text-green-600" : "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl lg:rounded-2xl py-2 lg:py-4 text-center shadow-sm border border-border/50">
            <p className={`text-[15px] lg:text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[9px] lg:text-xs text-gray-400 font-semibold uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Desktop: 2-column layout / Mobile: single column */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6">
        {/* Left column: Games (wider) */}
        <div className="lg:col-span-3">
          <Section title="Juegos" count={allEvents.length}>
            {l1 || l2 ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
            ) : allEvents.length > 0 ? (
              <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                {allEvents.map((e) => <GameRow key={e.id} event={e} odds={allOdds} />)}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-border/50">
                <p className="text-[12px] lg:text-sm text-gray-400">No hay juegos. Dale "Actualizar".</p>
              </div>
            )}
          </Section>
        </div>

        {/* Right column: Recommendations + Sims */}
        <div className="lg:col-span-2">
          {/* Recommendations */}
          {recs && recs.length > 0 && (
            <Section title="Mejores Apuestas" count={recs.length} href="/valor">
              <div className="space-y-2">
                {recs.map((r) => <RecCard key={r.id} rec={r as unknown as Record<string, unknown>} />)}
              </div>
            </Section>
          )}

          {/* Simulated Bets */}
          {bets.length > 0 && (
            <Section title="Simulaciones" count={bets.length} href="/simulaciones">
              <div className="space-y-2">
                {bets.map((b) => <SimRow key={b.id as number} bet={b} />)}
              </div>
            </Section>
          )}
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
