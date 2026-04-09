"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GameCard } from "@/components/odds/game-card";
import { useEvents, useSportOdds } from "@/hooks/use-odds";
import { useArbitrageOpportunities, useEvOpportunities } from "@/hooks/use-arbitrage";

export default function MlbPage() {
  const { data: events, isLoading } = useEvents("baseball_mlb");
  const { data: odds } = useSportOdds("baseball_mlb");
  const { data: arbs } = useArbitrageOpportunities("baseball_mlb");
  const { data: evs } = useEvOpportunities("baseball_mlb");

  const arbIds = new Set(arbs?.map((a) => a.event_id) ?? []);
  const evIds = new Set(evs?.map((e) => e.event_id) ?? []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">MLB</h1>
        <p className="text-sm text-gray-500 mt-1">Juegos y odds del beisbol</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <GameCard key={e.id} event={e} odds={odds ?? []} sportPath="mlb" hasArb={arbIds.has(e.id)} hasEv={evIds.has(e.id)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 4.5c1.5 2 1.5 5.5 0 8s-1.5 5.5 0 7.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-[14px] text-gray-400 font-medium">No hay juegos de MLB</p>
          <p className="text-[12px] text-gray-300 mt-1">Vuelve mas tarde o dale Sync</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
