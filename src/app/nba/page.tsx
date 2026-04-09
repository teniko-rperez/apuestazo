"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GameCard } from "@/components/odds/game-card";
import { useEvents, useSportOdds } from "@/hooks/use-odds";
import { useArbitrageOpportunities, useEvOpportunities } from "@/hooks/use-arbitrage";

export default function NbaPage() {
  const { data: events, isLoading } = useEvents("basketball_nba");
  const { data: odds } = useSportOdds("basketball_nba");
  const { data: arbs } = useArbitrageOpportunities("basketball_nba");
  const { data: evs } = useEvOpportunities("basketball_nba");

  const arbIds = new Set(arbs?.map((a) => a.event_id) ?? []);
  const evIds = new Set(evs?.map((e) => e.event_id) ?? []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">NBA</h1>
        <p className="text-sm text-gray-500 mt-1">Juegos y odds de la NBA</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <GameCard key={e.id} event={e} odds={odds ?? []} sportPath="nba" hasArb={arbIds.has(e.id)} hasEv={evIds.has(e.id)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-300" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <p className="text-[14px] text-gray-400 font-medium">No hay juegos de NBA</p>
          <p className="text-[12px] text-gray-300 mt-1">Vuelve mas tarde o dale Sync</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
