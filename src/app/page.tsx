"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useArbitrageOpportunities, useEvOpportunities } from "@/hooks/use-arbitrage";
import { formatOdds, explainOdds } from "@/lib/analysis/implied-probability";
import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";

/* ─── Rec Card ─── */
function RecCard({ rec }: { rec: Record<string, unknown> }) {
  const ev = rec.events as { home_team: string; away_team: string; sport_key?: string; commence_time?: string } | null;
  const conf = rec.confidence_score as number;
  const odds = rec.odds as number;
  const reasoning = rec.reasoning as string;
  const isSafe = reasoning?.includes('MAS SEGURA');
  const isSecure = reasoning?.includes('SEGURA') && !isSafe;
  const sport = ev?.sport_key === "basketball_nba" ? "NBA" : ev?.sport_key === "baseball_mlb" ? "MLB" : "";
  const time = ev?.commence_time
    ? `${new Date(ev.commence_time).toLocaleDateString("es-PR", { month: "short", day: "numeric" })} ${new Date(ev.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`
    : "";

  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-border/50">
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {sport && <Badge className="bg-gray-100 text-gray-600 text-[9px] h-4 px-1.5 font-bold">{sport}</Badge>}
        {isSafe && <Badge className="bg-green-100 text-green-700 text-[8px] h-4 px-1 font-bold">MAS SEGURA</Badge>}
        {isSecure && <Badge className="bg-blue-100 text-blue-700 text-[8px] h-4 px-1 font-bold">SEGURA</Badge>}
        <span className="text-[10px] font-bold text-blue-600 ml-auto">{Math.round(conf * 100)}%</span>
      </div>
      <p className="text-[10px] text-gray-400">
        {ev ? `${ev.away_team} vs ${ev.home_team}` : ""}
        {ev && <span className="text-blue-500 font-bold ml-1">({ev.home_team} HOME)</span>}
        {time && <span className="ml-1">&middot; {time}</span>}
      </p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[13px] font-semibold text-gray-800">{rec.outcome_name as string}</span>
        <div className="text-right">
          <span className="text-[14px] font-bold text-orange-500 font-mono">{formatOdds(odds)}</span>
          {odds !== 0 && <p className="text-[8px] text-gray-400">{explainOdds(odds, 50)}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Sim Bet Row ─── */
function SimRow({ bet }: { bet: Record<string, unknown> }) {
  const result = bet.result as string;
  const profit = bet.profit as number | null;
  const ev = bet.events as { home_team: string; away_team: string; commence_time?: string } | null;
  const borderColor = result === "won" ? "border-l-green-500" : result === "lost" ? "border-l-red-500" : "border-l-blue-400";

  return (
    <div className={`bg-white rounded-2xl p-3 shadow-sm border border-border/50 border-l-4 ${borderColor} flex items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {result === "won" && <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">GANADA</span>}
          {result === "lost" && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">PERDIDA</span>}
          {result === "pending" && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">PENDIENTE</span>}
          {ev?.commence_time && (
            <span className="text-[9px] text-gray-400">
              {new Date(ev.commence_time).toLocaleDateString("es-PR", { month: "short", day: "numeric" })}{" "}
              {new Date(ev.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 truncate">{ev ? `${ev.away_team} @ ${ev.home_team}` : ""}</p>
        <p className="text-[12px] font-semibold text-gray-800 truncate">{bet.outcome_name as string}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-bold font-mono text-orange-500">{formatOdds(bet.odds as number)}</p>
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
  const settledCount = bets.filter((b) => b.result !== "pending").length;

  // Split recommendations by sport
  const recs = (allRecs ?? []) as unknown as Array<Record<string, unknown>>;
  const nbaRecs = recs.filter((r) => (r.events as { sport_key?: string } | null)?.sport_key === "basketball_nba");
  const mlbRecs = recs.filter((r) => (r.events as { sport_key?: string } | null)?.sport_key === "baseball_mlb");

  return (
    <div>
      {/* Quick Stats */}
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

      {/* Desktop: 2-column (NBA left, MLB right) / Mobile: stacked */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        {/* NBA Recommendations */}
        <Section title="🏀 NBA Recomendaciones" count={nbaRecs.length}>
          {recsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : nbaRecs.length > 0 ? (
            <div className="space-y-2">
              {nbaRecs.map((r) => <RecCard key={r.id as number} rec={r} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-border/50">
              <p className="text-[12px] text-gray-400">Sin recomendaciones NBA. Dale Actualizar.</p>
            </div>
          )}
        </Section>

        {/* MLB Recommendations */}
        <Section title="⚾ MLB Recomendaciones" count={mlbRecs.length}>
          {recsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : mlbRecs.length > 0 ? (
            <div className="space-y-2">
              {mlbRecs.map((r) => <RecCard key={r.id as number} rec={r} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-border/50">
              <p className="text-[12px] text-gray-400">Sin recomendaciones MLB. Dale Actualizar.</p>
            </div>
          )}
        </Section>
      </div>

      {/* Simulated Bets */}
      {bets.length > 0 && (
        <Section title="Simulaciones Recientes" count={bets.length} href="/simulaciones">
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {bets.map((b) => <SimRow key={b.id as number} bet={b} />)}
          </div>
        </Section>
      )}

      <div className="h-4" />
    </div>
  );
}
