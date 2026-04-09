"use client";

import { useState } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceMeter } from "@/components/recommendations/confidence-meter";
import { getClient } from "@/lib/supabase/client";

interface ExpertPick {
  id: number;
  expert_name: string;
  source: string;
  source_url: string;
  sport: string;
  pick_type: string;
  pick_description: string;
  confidence: "alta" | "media" | "baja";
  record: string;
  profit_units: number | null;
  scraped_at: string;
}

function useExpertPicks(sport?: string) {
  return useSWR(`expert-picks-${sport ?? "all"}`, async () => {
    const supabase = getClient();
    let query = supabase.from("expert_picks").select("*").order("scraped_at", { ascending: false }).limit(50);
    if (sport) query = query.eq("sport", sport);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ExpertPick[];
  }, { refreshInterval: 120000 });
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Covers.com": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Reddit r/sportsbook": { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  "Reddit r/sportsbetting": { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  "Reddit r/NBAbetting": { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  "Reddit r/MLBbetting": { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  "Twitter/X": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
  "Action Network": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  WagerTalk: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
};

function PickCard({ pick }: { pick: ExpertPick }) {
  const confScore = pick.confidence === "alta" ? 0.85 : pick.confidence === "media" ? 0.7 : 0.5;
  const colors = SOURCE_COLORS[pick.source] ?? { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 card-hover">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[14px] font-bold text-gray-900">{pick.expert_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold ${colors.text} ${colors.bg} border ${colors.border} px-2 py-0.5 rounded-md`}>
              {pick.source}
            </span>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
              {pick.sport}
            </span>
          </div>
        </div>
        <ConfidenceMeter score={confScore} />
      </div>

      <p className="text-[13px] text-gray-700 leading-relaxed mb-3">{pick.pick_description}</p>

      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-50">
        <span className="text-gray-400 font-medium">Record: {pick.record}</span>
        {pick.profit_units != null && (
          <span className={`font-bold font-mono ${pick.profit_units > 0 ? "text-emerald-600" : "text-red-500"}`}>
            {pick.profit_units > 0 ? "+" : ""}{pick.profit_units} u
          </span>
        )}
        {pick.source_url && (
          <a href={pick.source_url} target="_blank" rel="noopener noreferrer"
            className="text-orange-500 font-semibold hover:text-orange-600 flex items-center gap-1">
            Ver fuente
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

export default function ExpertosPage() {
  const { data: allPicks, isLoading } = useExpertPicks();
  const { data: nbaPicks } = useExpertPicks("nba");
  const { data: mlbPicks } = useExpertPicks("mlb");
  const [tab, setTab] = useState<"all" | "nba" | "mlb">("all");

  const picks = tab === "nba" ? nbaPicks : tab === "mlb" ? mlbPicks : allPicks;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">Expertos</h1>
        <p className="text-sm text-gray-500 mt-1">Picks de handicappers y comunidades con records verificados</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <p className="text-[10px] text-gray-400 font-semibold">FUENTES</p>
          <p className="text-lg font-extrabold text-gray-900 mt-1">8+</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Covers, Reddit, X, Action</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <p className="text-[10px] text-gray-400 font-semibold">PICKS ACTIVOS</p>
          <p className="text-lg font-extrabold text-orange-500 mt-1">{allPicks?.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <p className="text-[10px] text-gray-400 font-semibold">ULTIMA ACT.</p>
          <p className="text-[13px] font-bold text-gray-700 mt-1">
            {allPicks?.[0]?.scraped_at
              ? new Date(allPicks[0].scraped_at).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })
              : "---"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: "all" as const, label: "Todos", count: allPicks?.length },
          { key: "nba" as const, label: "NBA", count: nbaPicks?.length },
          { key: "mlb" as const, label: "MLB", count: mlbPicks?.length },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${
              tab === t.key
                ? "bg-[#0f172a] text-white shadow-lg"
                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
            }`}>
            {t.label} <span className={tab === t.key ? "text-orange-400" : "text-gray-400"}>({t.count ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Picks */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : picks && picks.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {picks.map((pick) => <PickCard key={pick.id} pick={pick} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-[14px] text-gray-400 font-medium">No hay picks de expertos disponibles</p>
          <p className="text-[12px] text-gray-300 mt-1">Se actualizan con cada ejecucion del cron job</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
