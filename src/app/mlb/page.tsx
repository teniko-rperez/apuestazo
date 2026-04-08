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

  const arbEventIds = new Set(arbs?.map((a) => a.event_id) ?? []);
  const evEventIds = new Set(evs?.map((e) => e.event_id) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MLB Baseball</h1>
        <p className="text-muted-foreground text-sm">
          Odds y analisis de juegos de la MLB
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
              sportPath="mlb"
              hasArb={arbEventIds.has(event.id)}
              hasEv={evEventIds.has(event.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          No hay juegos de MLB programados proximamente.
        </p>
      )}
    </div>
  );
}
