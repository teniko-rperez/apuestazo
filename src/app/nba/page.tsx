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
      <h1 className="text-base lg:text-xl font-bold text-gray-800 mt-1 mb-3">🏀 NBA</h1>
      {isLoading ? (
        <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : events && events.length > 0 ? (
        <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
          {events.map((e) => (
            <GameCard key={e.id} event={e} odds={odds ?? []} sportPath="nba" hasArb={arbIds.has(e.id)} hasEv={evIds.has(e.id)} />
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-gray-400 text-center py-8">No hay juegos de NBA.</p>
      )}
    </div>
  );
}
