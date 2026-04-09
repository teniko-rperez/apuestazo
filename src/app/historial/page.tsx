"use client";

import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
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

function stats(bets: HistBet[]) {
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
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const allBets = bets ?? [];

  // Get unique months
  const months = [...new Set(allBets.map((b) => {
    const d = new Date(b.settled_at ?? b.placed_at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }))].sort().reverse();

  // Apply filters
  let filtered = allBets;
  if (sportFilter === "nba") filtered = filtered.filter((b) => b.events?.sport_key === "basketball_nba");
  if (sportFilter === "mlb") filtered = filtered.filter((b) => b.events?.sport_key === "baseball_mlb");
  if (monthFilter !== "all") {
    filtered = filtered.filter((b) => {
      const d = new Date(b.settled_at ?? b.placed_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === monthFilter;
    });
  }

  const s = stats(filtered);

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
      <h1 className="text-base lg:text-xl font-bold text-gray-800 mt-1 mb-1">Historial de Apuestas</h1>
      <p className="text-[11px] text-gray-400 mb-4">Registro completo de apuestas liquidadas</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5 lg:grid-cols-8 lg:gap-2 mb-4">
        {[
          { label: "TOTAL", value: s.total, color: "text-gray-800" },
          { label: "GANADAS", value: s.won, color: "text-green-600" },
          { label: "PERDIDAS", value: s.lost, color: "text-red-500" },
          { label: "WIN %", value: `${s.winRate.toFixed(0)}%`, color: "text-gray-800" },
          { label: "APOSTADO", value: `$${s.staked.toFixed(0)}`, color: "text-gray-600" },
          { label: "PROFIT", value: `${s.profit >= 0 ? "+" : ""}$${s.profit.toFixed(0)}`, color: s.profit >= 0 ? "text-green-600" : "text-red-500" },
          { label: "ROI", value: `${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1)}%`, color: s.roi >= 0 ? "text-green-600" : "text-red-500" },
          { label: "EMPATES", value: s.push, color: "text-yellow-600" },
        ].map((x) => (
          <div key={x.label} className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
            <p className={`text-[13px] lg:text-[15px] font-bold font-mono ${x.color}`}>{x.value}</p>
            <p className="text-[8px] lg:text-[9px] text-gray-400 font-semibold">{x.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { key: "all" as const, label: "Todas" },
          { key: "nba" as const, label: "🏀 NBA" },
          { key: "mlb" as const, label: "⚾ MLB" },
        ].map((t) => (
          <button key={t.key} onClick={() => setSportFilter(t.key)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
              sportFilter === t.key ? "bg-[#0a1929] text-white" : "bg-white text-gray-500 border border-gray-200"
            }`}>
            {t.label}
          </button>
        ))}
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white text-gray-600 border border-gray-200">
          <option value="all">Todos los meses</option>
          {months.map((m) => (
            <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("es-PR", { month: "long", year: "numeric" })}</option>
          ))}
        </select>
      </div>

      {/* Profit chart (simple bar) */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-border/50 mb-4">
          <p className="text-[11px] font-bold text-gray-600 mb-2">Profit acumulado</p>
          <div className="flex items-end gap-0.5 h-16">
            {(() => {
              let cumulative = 0;
              const bars = filtered.slice().reverse().map((b, i) => {
                cumulative += b.profit ?? 0;
                const height = Math.max(2, Math.min(60, Math.abs(cumulative) / (Math.max(Math.abs(s.profit), 50)) * 60));
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end">
                    <div className={`rounded-t-sm ${cumulative >= 0 ? "bg-green-400" : "bg-red-400"}`}
                      style={{ height: `${height}px` }} />
                  </div>
                );
              });
              return bars;
            })()}
          </div>
        </div>
      )}

      {/* Bets grouped by date */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, dateBets]) => {
            const dayProfit = dateBets.reduce((s, b) => s + (b.profit ?? 0), 0);
            const dayWon = dateBets.filter((b) => b.result === "won").length;
            return (
              <div key={date}>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-[11px] font-bold text-gray-600 uppercase">{date}</span>
                  <span className={`text-[11px] font-bold font-mono ${dayProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {dayWon}/{dateBets.length} &middot; {dayProfit >= 0 ? "+" : ""}${dayProfit.toFixed(0)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {dateBets.map((b) => {
                    const border = b.result === "won" ? "border-l-green-500" : b.result === "lost" ? "border-l-red-500" : "border-l-yellow-400";
                    return (
                      <div key={b.id} className={`bg-white rounded-xl p-2.5 shadow-sm border border-border/50 border-l-4 ${border} flex items-center gap-2`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {b.result === "won" && <span className="text-[8px] font-black text-green-700 bg-green-100 px-1 rounded">W</span>}
                            {b.result === "lost" && <span className="text-[8px] font-black text-red-600 bg-red-100 px-1 rounded">L</span>}
                            {b.result === "push" && <span className="text-[8px] font-black text-yellow-700 bg-yellow-100 px-1 rounded">P</span>}
                            <span className="text-[10px] text-gray-400 truncate">
                              {b.events ? `${b.events.away_team} @ ${b.events.home_team}` : ""}
                            </span>
                          </div>
                          <p className="text-[12px] font-semibold text-gray-800 truncate mt-0.5">{b.outcome_name}</p>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="text-[12px] font-bold font-mono text-orange-500">{formatOdds(b.odds)}</p>
                          <p className={`text-[11px] font-bold font-mono ${(b.profit ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {(b.profit ?? 0) >= 0 ? "+" : ""}${(b.profit ?? 0).toFixed(0)}
                          </p>
                          {b.events?.scores && (
                            <p className="text-[9px] text-gray-400 font-mono">{b.events.scores.away}-{b.events.scores.home}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-border/50">
          <p className="text-[12px] text-gray-400">No hay apuestas liquidadas aun.</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
