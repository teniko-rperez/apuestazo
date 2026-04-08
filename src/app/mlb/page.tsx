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
      <h1 className="text-base lg:text-xl font-bold text-gray-800 mt-1 mb-3">⚾ MLB</h1>
      {isLoading ? (
        <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : events && events.length > 0 ? (
        <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
          {events.map((e) => (
            <GameCard key={e.id} event={e} odds={odds ?? []} sportPath="mlb" hasArb={arbIds.has(e.id)} hasEv={evIds.has(e.id)} />
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-gray-400 text-center py-8">No hay juegos de MLB.</p>
      )}
    </div>
  );
}
