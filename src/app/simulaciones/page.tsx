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

function cleanReasoning(r?: string): string {
  if (!r) return "Sin razonamiento disponible";
  return r
    .replace(/🔒 MAS SEGURA \| /g, '')
    .replace(/✅ SEGURA \| /g, '')
    .replace(/\[.*?\]\s*/g, '')
    .replace(/\(\d\/3.*?\)\s*/g, '')
    .trim() || "Sin razonamiento disponible";
}

function BetRow({ bet }: { bet: SimBet }) {
  const [open, setOpen] = useState(false);
  const isCancelled = bet.reasoning?.includes('[CANCELADA');
  const cancelReason = bet.reasoning?.match(/\[CANCELADA: ([^\]]+)\]/)?.[1] ?? '';
  const rColor = isCancelled ? "text-gray-500" : bet.result === "won" ? "text-green-600" : bet.result === "lost" ? "text-red-500" : "text-blue-600";
  const rBg = isCancelled ? "bg-gray-100" : bet.result === "won" ? "bg-green-50" : bet.result === "lost" ? "bg-red-50" : "bg-blue-50";
  const borderColor = isCancelled ? "border-l-gray-400" : bet.result === "won" ? "border-l-green-500" : bet.result === "lost" ? "border-l-red-500" : "border-l-blue-400";

  // Parse signals from reasoning
  const signals = bet.reasoning?.match(/\[([^\]]+)\]/)?.[1]?.split(' + ') ?? [];
  const categories = bet.reasoning?.match(/\((\d)\/3 categorias, (\d+) senales\)/);
  const isSafe = bet.reasoning?.includes('MAS SEGURA');
  const isSecure = bet.reasoning?.includes('SEGURA') && !isSafe;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-border/50 border-l-4 ${borderColor} overflow-hidden`}>
      {/* Main row - clickable */}
      <div className="p-3 flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setOpen(!open)}>
        <div className={`w-9 h-9 rounded-full ${rBg} flex items-center justify-center shrink-0`}>
          <span className={`text-[11px] font-black ${rColor}`}>
            {bet.result === "won" ? "W" : bet.result === "lost" ? "L" : bet.result === "push" ? "P" : "..."}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
            {isCancelled ? (
              <Badge className="bg-gray-200 text-gray-600 text-[9px] h-4 px-1.5 font-bold">CANCELADA</Badge>
            ) : (
              <>
                {bet.result === "won" && <Badge className="bg-green-100 text-green-700 text-[9px] h-4 px-1.5 font-bold">GANADA</Badge>}
                {bet.result === "lost" && <Badge className="bg-red-100 text-red-600 text-[9px] h-4 px-1.5 font-bold">PERDIDA</Badge>}
                {bet.result === "push" && <Badge className="bg-yellow-100 text-yellow-700 text-[9px] h-4 px-1.5 font-bold">EMPATE</Badge>}
                {bet.result === "pending" && <Badge className="bg-blue-50 text-blue-600 text-[9px] h-4 px-1.5">PENDIENTE</Badge>}
                {isSafe && <Badge className="bg-green-100 text-green-700 text-[8px] h-4 px-1">MAS SEGURA</Badge>}
                {isSecure && <Badge className="bg-blue-100 text-blue-700 text-[8px] h-4 px-1">SEGURA</Badge>}
              </>
            )}
            {isCancelled && cancelReason && <span className="text-[8px] text-gray-400">{cancelReason}</span>}
            {bet.events?.commence_time && (
              <span className="text-[9px] text-gray-400">
                {new Date(bet.events.commence_time).toLocaleDateString("es-PR", { month: "short", day: "numeric" })}{" "}
                {new Date(bet.events.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 truncate">
            {bet.events ? `${bet.events.away_team} vs ${bet.events.home_team}` : ""}
            {bet.events && <span className="text-[9px] text-blue-500 font-bold ml-1">({bet.events.home_team} HOME)</span>}
          </p>
          <p className="text-[12px] text-gray-800 truncate">
            <span className="font-bold">Ganador:</span>{" "}
            {bet.outcome_name}
            {bet.events && bet.outcome_name === bet.events.home_team && <span className="text-[9px] text-blue-500 ml-1">HOME</span>}
          </p>
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
          <span className="text-[10px] text-gray-300">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expandable reasoning panel */}
      {open && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[11px] font-bold text-gray-700 mt-2 mb-1.5">Por que esta recomendacion?</p>

          {/* Signal badges */}
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {signals.map((s, i) => (
                <span key={i} className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}

          {/* Categories info */}
          {categories && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-0.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`w-4 h-1.5 rounded-full ${n <= parseInt(categories[1]) ? "bg-blue-500" : "bg-gray-200"}`} />
                ))}
              </div>
              <span className="text-[10px] text-gray-500">{categories[1]}/3 categorias, {categories[2]} senales</span>
            </div>
          )}

          {/* Full reasoning text */}
          <p className="text-[10px] text-gray-500 leading-relaxed">
            {cleanReasoning(bet.reasoning)}
          </p>
        </div>
      )}
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
