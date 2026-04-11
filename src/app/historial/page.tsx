"use client";

import { useState } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/lib/supabase/client";
import { formatOdds } from "@/lib/analysis/implied-probability";

interface HistBet {
  id: number;
  event_id: string;
  outcome_name: string;
  odds: number;
  stake: number;
  result: "won" | "lost" | "push" | "pending";
  profit: number | null;
  placed_at: string;
  settled_at: string | null;
  events?: {
    home_team: string;
    away_team: string;
    sport_key: string;
    commence_time: string;
    scores: { home: number; away: number } | null;
  };
}

function useHistory() {
  return useSWR("history-all", async () => {
    const s = getClient();
    const { data, error } = await s
      .from("simulated_bets")
      .select("*, events(home_team, away_team, sport_key, commence_time, scores)")
      .in("result", ["won", "lost", "push"])
      .order("settled_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as unknown as HistBet[];
  });
}

function HistRow({ bet }: { bet: HistBet }) {
  const [open, setOpen] = useState(false);
  const isFavorite = bet.odds < 0;
  const statusConfig = bet.result === "won"
    ? { bg: "bg-emerald-50", text: "text-emerald-700", label: "GANADA", dot: "bg-emerald-500", border: "border-l-emerald-500" }
    : bet.result === "lost"
    ? { bg: "bg-red-50", text: "text-red-600", label: "PERDIDA", dot: "bg-red-500", border: "border-l-red-500" }
    : { bg: "bg-amber-50", text: "text-amber-700", label: "EMPATE", dot: "bg-amber-500", border: "border-l-amber-400" };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${statusConfig.border} card-hover overflow-hidden`}>
      <div className="p-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between mb-2">
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
        <p className="text-[12px] text-gray-600 mb-1.5">{bet.events ? `${bet.events.away_team} vs ${bet.events.home_team}` : ""}</p>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 font-medium uppercase">Ganador:</p>
          <p className="text-[15px] font-bold text-gray-900">{bet.outcome_name}</p>
          {isFavorite && (
            <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">FAV</span>
          )}
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-gray-500">Odds</p>
            <p className="text-[13px] font-extrabold font-mono text-orange-500">{formatOdds(bet.odds)}</p>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-gray-500">Profit</p>
            <p className={`text-[13px] font-extrabold font-mono ${(bet.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {(bet.profit ?? 0) >= 0 ? "+" : ""}${(bet.profit ?? 0).toFixed(0)}
            </p>
          </div>
          {bet.events?.scores && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-gray-500">Score</p>
              <p className="text-[12px] text-gray-600 font-mono">{bet.events.scores.away} - {bet.events.scores.home}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function calcStats(bets: HistBet[]) {
  const won = bets.filter((b) => b.result === "won").length;
  const lost = bets.filter((b) => b.result === "lost").length;
  const push = bets.filter((b) => b.result === "push").length;
  const profit = bets.reduce((s, b) => s + (b.profit ?? 0), 0);
  const staked = bets.reduce((s, b) => s + b.stake, 0);
  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;
  return { won, lost, push, profit, staked, roi, winRate, total: bets.length };
}

export default function HistorialPage() {
  const { data: bets, isLoading } = useHistory();
  const [sportFilter, setSportFilter] = useState<"all" | "nba" | "mlb">("all");

  const allBets = bets ?? [];
  let filtered = allBets;
  if (sportFilter === "nba") filtered = filtered.filter((b) => b.events?.sport_key === "basketball_nba");
  if (sportFilter === "mlb") filtered = filtered.filter((b) => b.events?.sport_key === "baseball_mlb");

  const s = calcStats(filtered);

  // Group by date
  const byDate = new Map<string, HistBet[]>();
  for (const b of filtered) {
    const d = new Date(b.events?.commence_time ?? b.placed_at).toLocaleDateString("es-PR", { weekday: "short", month: "short", day: "numeric" });
    const list = byDate.get(d) ?? [];
    list.push(b);
    byDate.set(d, list);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">Historial</h1>
        <p className="text-sm text-gray-500 mt-1">Registro completo de apuestas liquidadas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-8 lg:gap-3 mb-5">
        {[
          { label: "TOTAL", value: s.total, color: "text-gray-900" },
          { label: "GANADAS", value: s.won, color: "text-emerald-600" },
          { label: "PERDIDAS", value: s.lost, color: "text-red-500" },
          { label: "WIN %", value: `${s.winRate.toFixed(0)}%`, color: "text-gray-900" },
          { label: "APOSTADO", value: `$${s.staked.toFixed(0)}`, color: "text-gray-600" },
          { label: "PROFIT", value: `${s.profit >= 0 ? "+" : ""}$${s.profit.toFixed(0)}`, color: s.profit >= 0 ? "text-emerald-600" : "text-red-500" },
          { label: "ROI", value: `${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1)}%`, color: s.roi >= 0 ? "text-emerald-600" : "text-red-500" },
          { label: "EMPATES", value: s.push, color: "text-amber-600" },
        ].map((x) => (
          <div key={x.label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
            <p className={`text-[14px] lg:text-[16px] font-extrabold font-mono ${x.color}`}>{x.value}</p>
            <p className="text-[8px] lg:text-[9px] text-gray-400 font-semibold mt-0.5">{x.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {[
          { key: "all" as const, label: "Todas" },
          { key: "nba" as const, label: "NBA" },
          { key: "mlb" as const, label: "MLB" },
        ].map((t) => (
          <button key={t.key} onClick={() => setSportFilter(t.key)}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${
              sportFilter === t.key
                ? "bg-[#0f172a] text-white shadow-lg"
                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cumulative profit */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
          <p className="text-[12px] font-bold text-gray-700 mb-3">Profit acumulado</p>
          <div className="flex items-end gap-[2px] h-20">
            {(() => {
              let cumulative = 0;
              return filtered.slice().reverse().map((b, i) => {
                cumulative += b.profit ?? 0;
                const maxVal = Math.max(Math.abs(s.profit), 50);
                const height = Math.max(3, Math.min(72, Math.abs(cumulative) / maxVal * 72));
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end">
                    <div
                      className={`rounded-t transition-all ${cumulative >= 0 ? "bg-gradient-to-t from-emerald-400 to-emerald-300" : "bg-gradient-to-t from-red-400 to-red-300"}`}
                      style={{ height: `${height}px` }}
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Bets grouped by date */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-5">
          {[...byDate.entries()].map(([date, dateBets]) => {
            const dayProfit = dateBets.reduce((s, b) => s + (b.profit ?? 0), 0);
            const dayWon = dateBets.filter((b) => b.result === "won").length;
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[12px] font-bold text-gray-700 uppercase">{date}</span>
                  <span className={`text-[12px] font-extrabold font-mono ${dayProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {dayWon}/{dateBets.length} &middot; {dayProfit >= 0 ? "+" : ""}${dayProfit.toFixed(0)}
                  </span>
                </div>
                <div className="space-y-2">
                  {dateBets.map((b) => <HistRow key={b.id} bet={b} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-[14px] text-gray-400 font-medium">No hay apuestas liquidadas</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
