"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceMeter } from "@/components/recommendations/confidence-meter";
import { useEvOpportunities } from "@/hooks/use-arbitrage";
import { useRecommendations } from "@/hooks/use-recommendations";
import { BetCard } from "@/components/recommendations/bet-card";
import { BOOKMAKERS, MARKET_LABELS, SPORTS } from "@/lib/constants";
import { formatOdds, formatPct } from "@/lib/analysis/implied-probability";

export default function ValorPage() {
  const { data: evs, isLoading: evsLoading } = useEvOpportunities();
  const { data: parlayRecs } = useRecommendations("parlay_leg");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">Valor +EV</h1>
        <p className="text-sm text-gray-500 mt-1">Apuestas donde las odds ofrecidas son mejores que las odds justas</p>
      </div>

      {evsLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : evs && evs.length > 0 ? (
        <div className="space-y-3">
          {evs.map((ev) => {
            const sport = ev.event?.sport_key ? SPORTS[ev.event.sport_key as keyof typeof SPORTS] : null;
            const confidenceScore = ev.confidence === "alta" ? 0.85 : ev.confidence === "media" ? 0.7 : 0.55;
            return (
              <div key={ev.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 card-hover">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {sport && <span>{sport.emoji}</span>}
                      <span className="text-[13px] font-medium text-gray-700">
                        {ev.event ? `${ev.event.away_team} @ ${ev.event.home_team}` : "Evento"}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {MARKET_LABELS[ev.market_key] ?? ev.market_key}
                      </span>
                    </div>
                    <p className="text-[15px] font-bold text-gray-900">{ev.outcome_name}</p>
                    <p className="text-[11px] text-gray-400">{BOOKMAKERS[ev.bookmaker_key]?.name ?? ev.bookmaker_key}</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-medium">Odds</p>
                      <p className="text-[16px] font-extrabold text-orange-500 font-mono">{formatOdds(ev.odds)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-medium">Justas</p>
                      <p className="text-[14px] font-bold text-gray-500 font-mono">{formatOdds(ev.fair_odds)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-medium">Edge</p>
                      <p className="text-[14px] font-extrabold text-emerald-600 font-mono">{formatPct(ev.edge_pct)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-medium">Kelly</p>
                      <p className="text-[13px] font-bold text-gray-600 font-mono">{formatPct(ev.kelly_fraction)}</p>
                    </div>
                    <ConfidenceMeter score={confidenceScore} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <p className="text-[14px] text-gray-400 font-medium">No hay oportunidades +EV activas</p>
          <p className="text-[12px] text-gray-300 mt-1">Se detectan automaticamente cada 15 minutos</p>
        </div>
      )}

      {parlayRecs && parlayRecs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Parlays Sugeridos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parlayRecs.map((rec) => <BetCard key={rec.id} rec={rec} />)}
          </div>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
