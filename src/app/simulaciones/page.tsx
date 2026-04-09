"use client";

import { useState } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/lib/supabase/client";
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
  result: "pending" | "won" | "lost" | "push" | "cancelled";
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
  const cancelledCount = bets.filter((b) => b.result === "cancelled" || (b.result === "push" && b.reasoning?.includes("CANCELADA"))).length;
  const pending = bets.filter((b) => b.result === "pending").length;
  const settled = won + lost;
  const profit = bets.reduce((s, b) => s + (b.profit ?? 0), 0);
  const winRate = settled > 0 ? ((won / settled) * 100).toFixed(0) : "0";
  return { total: bets.length, won, lost, cancelled: cancelledCount, pending, settled, profit, winRate };
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

function BetCard({ bet }: { bet: SimBet }) {
  const [open, setOpen] = useState(false);
  const isCancelled = bet.result === "cancelled" || bet.reasoning?.includes('[CANCELADA');
  const cancelReason = bet.reasoning?.match(/\[CANCELADA[^:]*: ([^\]]+)\]/)?.[1] ?? '';

  const statusConfig = isCancelled
    ? { dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-500", label: "CANCELADA", border: "border-l-gray-300" }
    : bet.result === "won"
    ? { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "GANADA", border: "border-l-emerald-500" }
    : bet.result === "lost"
    ? { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-600", label: "PERDIDA", border: "border-l-red-500" }
    : bet.result === "push"
    ? { dot: "bg-yellow-500", bg: "bg-yellow-50", text: "text-yellow-700", label: "EMPATE", border: "border-l-yellow-400" }
    : { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-600", label: "PENDIENTE", border: "border-l-blue-500" };

  const signals = bet.reasoning?.match(/\[([^\]]+)\]/)?.[1]?.split(' + ') ?? [];
  const categories = bet.reasoning?.match(/\((\d)\/3 categorias, (\d+) senales\)/);
  const isSafe = bet.reasoning?.includes('MAS SEGURA');
  const isSecure = bet.reasoning?.includes('SEGURA') && !isSafe;
  const sport = bet.events?.sport_key === "basketball_nba" ? "NBA" : "MLB";

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${statusConfig.border} overflow-hidden card-hover`}>
      <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        {/* Top row: status + sport + time */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
            <span className={`text-[10px] font-bold ${statusConfig.text} ${statusConfig.bg} px-2 py-0.5 rounded-md`}>
              {statusConfig.label}
            </span>
            <span className={`text-[10px] font-black text-white px-1.5 py-0.5 rounded ${sport === "NBA" ? "bg-orange-500" : "bg-blue-500"}`}>
              {sport}
            </span>
            {isSafe && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">MAS SEGURA</span>}
            {isSecure && <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">SEGURA</span>}
          </div>
          <div className="flex items-center gap-2">
            {bet.profit != null && !isCancelled && (
              <span className={`text-[14px] font-extrabold font-mono ${bet.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {bet.profit >= 0 ? "+" : ""}${bet.profit.toFixed(0)}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {/* Teams */}
        <div className="mb-2">
          <p className="text-[12px] text-gray-500">
            {bet.events ? `${bet.events.away_team}` : ""}
            {bet.events?.scores && <span className="font-bold text-gray-800 mx-1">{bet.events.scores.away}</span>}
            {" vs "}
            {bet.events ? `${bet.events.home_team}` : ""}
            {bet.events?.scores && <span className="font-bold text-gray-800 mx-1">{bet.events.scores.home}</span>}
            {bet.events && <span className="text-[10px] text-blue-500 font-semibold ml-1">({bet.events.home_team} HOME)</span>}
          </p>
          {bet.events?.commence_time && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              {new Date(bet.events.commence_time).toLocaleDateString("es-PR", { weekday: "short", month: "short", day: "numeric" })}{" "}
              {new Date(bet.events.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Pick + Odds */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 font-medium">Ganador</p>
            <p className="text-[16px] font-bold text-gray-900">
              {bet.outcome_name}
              {bet.events && bet.outcome_name === bet.events.home_team && <span className="text-[9px] text-blue-500 font-semibold ml-1">HOME</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold text-orange-500 font-mono">{formatOdds(bet.odds)}</p>
            {bet.odds !== 0 && <p className="text-[10px] text-gray-400">{explainOdds(bet.odds, bet.stake)}</p>}
          </div>
        </div>

        {isCancelled && cancelReason && (
          <p className="text-[10px] text-gray-400 italic mt-2">Razon: {cancelReason}</p>
        )}
      </div>

      {/* Expanded reasoning */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
          <p className="text-[12px] font-bold text-gray-700 mt-3 mb-2">Por que esta recomendacion?</p>

          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {signals.map((s, i) => (
                <span key={i} className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">{s}</span>
              ))}
            </div>
          )}

          {categories && (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`w-8 h-2 rounded-full ${n <= parseInt(categories[1]) ? "bg-orange-500" : "bg-gray-200"}`} />
                ))}
              </div>
              <span className="text-[11px] text-gray-500 font-medium">{categories[1]}/3 categorias, {categories[2]} senales</span>
            </div>
          )}

          <p className="text-[11px] text-gray-500 leading-relaxed">
            {cleanReasoning(bet.reasoning)}
          </p>
        </div>
      )}
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
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">Simulaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Apuestas simuladas de $50 en favoritos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: "all" as const, label: "Todas", count: allBets.length },
          { key: "nba" as const, label: "NBA", count: nbaBets.length },
          { key: "mlb" as const, label: "MLB", count: mlbBets.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${
              tab === t.key
                ? "bg-[#0f172a] text-white shadow-lg"
                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
            }`}
          >
            {t.label} <span className={tab === t.key ? "text-orange-400" : "text-gray-400"}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-2 lg:gap-3 mb-6">
        {[
          { label: "TOTAL", value: stats.total, color: "text-gray-900" },
          { label: "GANADAS", value: stats.won, color: "text-emerald-600" },
          { label: "CANCEL", value: stats.cancelled, color: "text-gray-500" },
          { label: "WIN %", value: `${stats.winRate}%`, color: "text-gray-900" },
          { label: "P/L", value: `${stats.profit >= 0 ? "+" : ""}$${stats.profit.toFixed(0)}`, color: stats.profit >= 0 ? "text-emerald-600" : "text-red-500" },
        ].map((x) => (
          <div key={x.label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
            <p className={`text-lg lg:text-xl font-extrabold font-mono ${x.color} stat-number`}>{x.value}</p>
            <p className="text-[9px] lg:text-[10px] text-gray-400 font-semibold mt-0.5">{x.label}</p>
          </div>
        ))}
      </div>

      {/* Bet cards */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : displayed.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {displayed.map((b) => <BetCard key={b.id} bet={b} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[14px] text-gray-400 font-medium">No hay apuestas simuladas</p>
          <p className="text-[12px] text-gray-300 mt-1">Dale Sync para actualizar</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
