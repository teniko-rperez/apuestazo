"use client";

import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/lib/supabase/client";
import { BOOKMAKERS, MARKET_LABELS } from "@/lib/constants";
import { formatOdds, explainOdds } from "@/lib/analysis/implied-probability";

interface SimBet {
  id: number;
  event_id: string;
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  stake: number;
  source: string;
  reasoning: string;
  result: "pending" | "won" | "lost" | "push";
  profit: number | null;
  placed_at: string;
  events?: {
    home_team: string;
    away_team: string;
    sport_key: string;
    commence_time: string;
    scores: { home: number; away: number } | null;
  };
}

function useSimBets() {
  return useSWR("sim-bets-all", async () => {
    const s = getClient();
    const { data, error } = await s
      .from("simulated_bets")
      .select("*, events(home_team, away_team, sport_key, commence_time, scores)")
      .order("placed_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as unknown as SimBet[];
  }, { refreshInterval: 30000 });
}

function calcStats(bets: SimBet[]) {
  const won = bets.filter((b) => b.result === "won").length;
  const lost = bets.filter((b) => b.result === "lost").length;
  const settled = won + lost;
  const profit = bets.reduce((s, b) => s + (b.profit ?? 0), 0);
  const winRate = settled > 0 ? ((won / settled) * 100).toFixed(0) : "0";
  return { total: bets.length, won, lost, settled, profit, winRate };
}

function BetRow({ bet }: { bet: SimBet }) {
  const rColor = bet.result === "won" ? "text-green-600" : bet.result === "lost" ? "text-red-500" : "text-blue-600";
  const rBg = bet.result === "won" ? "bg-green-50" : bet.result === "lost" ? "bg-red-50" : "bg-blue-50";

  const borderColor = bet.result === "won" ? "border-l-green-500" : bet.result === "lost" ? "border-l-red-500" : "border-l-blue-400";

  return (
    <div className={`bg-white rounded-2xl p-3 shadow-sm border border-border/50 border-l-4 ${borderColor} flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-full ${rBg} flex items-center justify-center shrink-0`}>
        <span className={`text-[11px] font-black ${rColor}`}>
          {bet.result === "won" ? "W" : bet.result === "lost" ? "L" : bet.result === "push" ? "P" : "..."}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {bet.result === "won" && <Badge className="bg-green-100 text-green-700 text-[9px] h-4 px-1.5 font-bold">GANADA</Badge>}
          {bet.result === "lost" && <Badge className="bg-red-100 text-red-600 text-[9px] h-4 px-1.5 font-bold">PERDIDA</Badge>}
          {bet.result === "push" && <Badge className="bg-yellow-100 text-yellow-700 text-[9px] h-4 px-1.5 font-bold">EMPATE</Badge>}
          {bet.result === "pending" && <Badge className="bg-blue-50 text-blue-600 text-[9px] h-4 px-1.5">PENDIENTE</Badge>}
          {bet.events?.commence_time && (
            <span className="text-[9px] text-gray-400">
              {new Date(bet.events.commence_time).toLocaleDateString("es-PR", { month: "short", day: "numeric" })}{" "}
              {new Date(bet.events.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 truncate">
          {bet.events ? `${bet.events.away_team} @ ${bet.events.home_team}` : ""}
        </p>
        <p className="text-[12px] font-semibold text-gray-800 truncate">{bet.outcome_name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13px] font-bold font-mono text-orange-500">{formatOdds(bet.odds)}</p>
        {bet.odds !== 0 && (
          <p className="text-[9px] text-gray-400">{explainOdds(bet.odds, bet.stake)}</p>
        )}
        {bet.profit != null && (
          <p className={`text-[12px] font-bold font-mono ${bet.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
            {bet.profit >= 0 ? "+" : ""}${bet.profit.toFixed(0)}
          </p>
        )}
        {bet.events?.scores && (
          <p className="text-[10px] text-gray-400 font-mono">{bet.events.scores.away}-{bet.events.scores.home}</p>
        )}
      </div>
    </div>
  );
}

function StatsBar({ stats }: { stats: ReturnType<typeof calcStats> }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 mb-4">
      <div className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
        <p className="text-[14px] font-bold font-mono text-gray-800">{stats.total}</p>
        <p className="text-[9px] text-gray-400 font-semibold">TOTAL</p>
      </div>
      <div className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
        <p className="text-[14px] font-bold font-mono text-green-600">{stats.won}</p>
        <p className="text-[9px] text-gray-400 font-semibold">GANADAS</p>
      </div>
      <div className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
        <p className="text-[14px] font-bold font-mono text-gray-800">{stats.winRate}%</p>
        <p className="text-[9px] text-gray-400 font-semibold">WIN RATE</p>
      </div>
      <div className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
        <p className={`text-[14px] font-bold font-mono ${stats.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
          {stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(0)}
        </p>
        <p className="text-[9px] text-gray-400 font-semibold">P/L</p>
      </div>
    </div>
  );
}

export default function SimulacionesPage() {
  const { data: bets, isLoading } = useSimBets();
  const [tab, setTab] = useState<"all" | "nba" | "mlb">("all");

  const allBets = bets ?? [];
  const nbaBets = allBets.filter((b) => b.events?.sport_key === "basketball_nba");
  const mlbBets = allBets.filter((b) => b.events?.sport_key === "baseball_mlb");

  const displayed = tab === "nba" ? nbaBets : tab === "mlb" ? mlbBets : allBets;
  const stats = calcStats(displayed);

  return (
    <div>
      <h1 className="text-base lg:text-xl font-bold text-gray-800 mt-1 mb-3">Apuestas Simuladas</h1>

      {/* Sport tabs */}
      <div className="flex gap-1.5 mb-4">
        {[
          { key: "all" as const, label: "Todas", count: allBets.length },
          { key: "nba" as const, label: "🏀 NBA", count: nbaBets.length },
          { key: "mlb" as const, label: "⚾ MLB", count: mlbBets.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${
              tab === t.key
                ? "bg-white text-orange-500 border border-orange-300 shadow-sm"
                : "bg-white text-gray-500 border border-border/50"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <StatsBar stats={stats} />

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : displayed.length > 0 ? (
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {displayed.map((b) => <BetRow key={b.id} bet={b} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-border/50">
          <p className="text-[12px] text-gray-400">No hay apuestas simuladas. Dale "Actualizar".</p>
        </div>
      )}
    </div>
  );
}
