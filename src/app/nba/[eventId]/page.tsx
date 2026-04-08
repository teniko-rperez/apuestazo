"use client";

import { use } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OddsTable } from "@/components/odds/odds-table";
import { useEvent, useEventOdds } from "@/hooks/use-odds";

export default function NbaGameDetail({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: odds, isLoading: oddsLoading } = useEventOdds(eventId);

  if (eventLoading) return <Skeleton className="h-96" />;
  if (!event) return <p className="text-muted-foreground">Evento no encontrado.</p>;

  const gameTime = new Date(event.commence_time).toLocaleString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/nba"
          className="text-sm text-green-400 hover:underline mb-2 block"
        >
          &larr; Volver a NBA
        </Link>
        <h1 className="text-2xl font-bold">
          {event.away_team} @ {event.home_team}
        </h1>
        <p className="text-muted-foreground text-sm">{gameTime}</p>
      </div>

      {oddsLoading ? (
        <Skeleton className="h-64" />
      ) : odds && odds.length > 0 ? (
        <Tabs defaultValue="h2h">
          <TabsList>
            <TabsTrigger value="h2h">Ganador</TabsTrigger>
            <TabsTrigger value="spreads">Handicap</TabsTrigger>
            <TabsTrigger value="totals">Total</TabsTrigger>
          </TabsList>
          <TabsContent value="h2h">
            <OddsTable odds={odds} marketKey="h2h" />
          </TabsContent>
          <TabsContent value="spreads">
            <OddsTable odds={odds} marketKey="spreads" />
          </TabsContent>
          <TabsContent value="totals">
            <OddsTable odds={odds} marketKey="totals" />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-muted-foreground">
          No hay datos de odds para este juego aun.
        </p>
      )}
    </div>
  );
}
