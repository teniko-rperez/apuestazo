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

  const arbEventIds = new Set(arbs?.map((a) => a.event_id) ?? []);
  const evEventIds = new Set(evs?.map((e) => e.event_id) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NBA Basketball</h1>
        <p className="text-muted-foreground text-sm">
          Odds y analisis de juegos de la NBA
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <GameCard
              key={event.id}
              event={event}
              odds={odds ?? []}
              sportPath="nba"
              hasArb={arbEventIds.has(event.id)}
              hasEv={evEventIds.has(event.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          No hay juegos de NBA programados proximamente.
        </p>
      )}
    </div>
  );
}
