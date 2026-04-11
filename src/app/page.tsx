"use client";

import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useArbitrageOpportunities, useEvOpportunities } from "@/hooks/use-arbitrage";
import { formatOdds, explainOdds } from "@/lib/analysis/implied-probability";
import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 card-hover">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-extrabold text-gray-900 font-mono stat-number">{value}</p>
      <p className="text-[11px] text-gray-500 font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Rec Card ─── */
function RecCard({ rec }: { rec: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const ev = rec.events as { home_team: string; away_team: string; sport_key?: string; commence_time?: string } | null;
  const conf = rec.confidence_score as number;
  const odds = rec.odds as number;
  const reasoning = rec.reasoning as string;
  const isSafe = reasoning?.includes('MAS SEGURA');
  const isSecure = reasoning?.includes('SEGURA') && !isSafe;
  const sport = ev?.sport_key === "basketball_nba" ? "NBA" : ev?.sport_key === "baseball_mlb" ? "MLB" : "";
  const sportColor = sport === "NBA" ? "from-orange-500 to-red-500" : "from-blue-500 to-indigo-500";
  const time = ev?.commence_time
    ? `${new Date(ev.commence_time).toLocaleDateString("es-PR", { month: "short", day: "numeric" })} ${new Date(ev.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`
    : "";
  const isFavorite = odds < 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 card-hover overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between mb-3">
          {sport && (
            <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-md bg-gradient-to-r ${sportColor}`}>
              {sport}
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        <p className="text-[13px] text-gray-600 mb-2">
          {ev ? `${ev.away_team} vs ${ev.home_team}` : ""}
        </p>

        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 font-medium uppercase">Ganador:</p>
          <p className="text-[16px] font-bold text-gray-900">{rec.outcome_name as string}</p>
          {isFavorite && (
            <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
              FAV
            </span>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center justify-between mt-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {isSafe && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">MAS SEGURA</span>}
              {isSecure && <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">SEGURA</span>}
              {ev && (rec.outcome_name as string) === ev.home_team && <span className="text-[9px] text-blue-500 font-semibold">HOME</span>}
            </div>
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
              <span className="text-[11px] font-black text-orange-600">{Math.round(conf * 100)}%</span>
            </div>
          </div>

          {time && <p className="text-[10px] text-gray-400 mb-2">{time}</p>}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-500">Odds</p>
            <div className="text-right">
              <p className="text-lg font-extrabold text-orange-500 font-mono">{formatOdds(odds)}</p>
              {odds !== 0 && <p className="text-[10px] text-gray-400">{explainOdds(odds, 50)}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sim Row ─── */
function SimRow({ bet }: { bet: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const result = bet.result as string;
  const profit = bet.profit as number | null;
  const odds = bet.odds as number;
  const ev = bet.events as { home_team: string; away_team: string; commence_time?: string; scores?: { home: number; away: number } | null } | null;
  const isCancelled = result === "cancelled" || result === "push" && (bet.reasoning as string)?.includes("CANCELADA");
  const isFavorite = odds < 0;

  const statusConfig = isCancelled
    ? { bg: "bg-gray-50", text: "text-gray-500", label: "CANCELADA", dot: "bg-gray-400", border: "border-l-gray-300" }
    : result === "won"
    ? { bg: "bg-emerald-50", text: "text-emerald-700", label: "GANADA", dot: "bg-emerald-500", border: "border-l-emerald-500" }
    : result === "lost"
    ? { bg: "bg-red-50", text: "text-red-600", label: "PERDIDA", dot: "bg-red-500", border: "border-l-red-500" }
    : { bg: "bg-blue-50", text: "text-blue-600", label: "PENDIENTE", dot: "bg-blue-500", border: "border-l-blue-500" };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${statusConfig.border} card-hover overflow-hidden`}>
      <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
            <span className={`text-[11px] font-bold ${statusConfig.text} ${statusConfig.bg} px-2 py-0.5 rounded-md`}>
              {statusConfig.label}
            </span>
          </div>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        <p className="text-[13px] text-gray-600 mb-2">{ev ? `${ev.away_team} vs ${ev.home_team}` : ""}</p>

        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 font-medium uppercase">Ganador:</p>
          <p className="text-[16px] font-bold text-gray-900">{bet.outcome_name as string}</p>
          {isFavorite && (
            <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
              FAV
            </span>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center justify-between mt-3 mb-2">
            {ev?.commence_time && (
              <span className="text-[10px] text-gray-400">
                {new Date(ev.commence_time).toLocaleDateString("es-PR", { month: "short", day: "numeric" })}{" "}
                {new Date(ev.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            {profit != null && !isCancelled && (
              <span className={`text-[14px] font-extrabold font-mono ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-gray-500">Odds</p>
            <span className="text-[15px] font-extrabold text-orange-500 font-mono">{formatOdds(odds)}</span>
          </div>
          {ev?.scores && (
            <p className="text-[11px] text-gray-400 font-mono">
              Score: {ev.scores.away} - {ev.scores.home}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Section ─── */
function Section({ title, count, href, children }: { title: string; count?: number; href?: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          {title} {count != null && count > 0 && <span className="text-orange-500 text-sm font-medium ml-1">({count})</span>}
        </h2>
        {href && (
          <Link href={href} className="text-[12px] text-orange-500 font-semibold hover:text-orange-600 transition-colors flex items-center gap-1">
            Ver todo
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const { data: allRecs, isLoading: recsLoading } = useRecommendations(undefined, 30);
  const { data: arbs } = useArbitrageOpportunities();
  const { data: evs } = useEvOpportunities();

  const { data: simBets } = useSWR("sim-home", async () => {
    const s = getClient();
    const { data } = await s.from("simulated_bets").select("*, events(home_team, away_team, commence_time, scores)").order("placed_at", { ascending: false }).limit(10);
    return data ?? [];
  });

  const bets = (simBets ?? []) as Array<Record<string, unknown>>;
  const totalProfit = bets.reduce((s, b) => s + ((b.profit as number) ?? 0), 0);
  const wonCount = bets.filter((b) => b.result === "won").length;
  const lostCount = bets.filter((b) => b.result === "lost").length;

  const recs = (allRecs ?? []) as unknown as Array<Record<string, unknown>>;
  const nbaRecs = recs.filter((r) => (r.events as { sport_key?: string } | null)?.sport_key === "basketball_nba");
  const mlbRecs = recs.filter((r) => (r.events as { sport_key?: string } | null)?.sport_key === "baseball_mlb");

  return (
    <div>
      {/* Hero greeting */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">Resumen de tus apuestas y recomendaciones</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Arbitraje"
          value={arbs?.length ?? 0}
          sub="oportunidades activas"
          color="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
        />
        <StatCard
          label="Valor +EV"
          value={evs?.length ?? 0}
          sub="apuestas con valor"
          color="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
        />
        <StatCard
          label="Record"
          value={`${wonCount}W - ${lostCount}L`}
          sub={bets.length > 0 ? `${((wonCount / Math.max(wonCount + lostCount, 1)) * 100).toFixed(0)}% win rate` : undefined}
          color="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>}
        />
        <StatCard
          label="Profit / Loss"
          value={`${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(0)}`}
          sub="acumulado total"
          color={totalProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}
          icon={<svg className={`w-5 h-5 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Recommendations - 2 column on desktop */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <Section title="NBA" count={nbaRecs.length} href="/nba">
          {recsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
          ) : nbaRecs.length > 0 ? (
            <div className="space-y-3">
              {nbaRecs.map((r) => <RecCard key={r.id as number} rec={r} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-[13px] text-gray-400 font-medium">Sin recomendaciones NBA</p>
              <p className="text-[11px] text-gray-300 mt-1">Dale Sync para actualizar</p>
            </div>
          )}
        </Section>

        <Section title="MLB" count={mlbRecs.length} href="/mlb">
          {recsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
          ) : mlbRecs.length > 0 ? (
            <div className="space-y-3">
              {mlbRecs.map((r) => <RecCard key={r.id as number} rec={r} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-[13px] text-gray-400 font-medium">Sin recomendaciones MLB</p>
              <p className="text-[11px] text-gray-300 mt-1">Dale Sync para actualizar</p>
            </div>
          )}
        </Section>
      </div>

      {/* Recent Simulations */}
      {bets.length > 0 && (
        <Section title="Simulaciones Recientes" count={bets.length} href="/simulaciones">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {bets.map((b) => <SimRow key={b.id as number} bet={b} />)}
          </div>
        </Section>
      )}

      <div className="h-8" />
    </div>
  );
}
