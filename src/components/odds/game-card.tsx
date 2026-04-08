"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BOOKMAKERS } from "@/lib/constants";
import { formatOdds } from "@/lib/analysis/implied-probability";
import type { GameEvent } from "@/types/event";
import type { LatestOdds, Outcome } from "@/types/odds";

interface GameCardProps {
  event: GameEvent;
  odds: LatestOdds[];
  sportPath: string;
  hasArb?: boolean;
  hasEv?: boolean;
}

export function GameCard({ event, odds, sportPath, hasArb, hasEv }: GameCardProps) {
  const gameTime = new Date(event.commence_time).toLocaleString("es-ES", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Get h2h moneyline odds for quick display
  const h2hOdds = odds.filter(
    (o) => o.event_id === event.id && o.market_key === "h2h"
  );

  // Find best moneyline for each team
  const bestHome = findBestOdds(h2hOdds, event.home_team);
  const bestAway = findBestOdds(h2hOdds, event.away_team);

  return (
    <Link href={`/${sportPath}/${event.id}`}>
      <Card className="hover:border-green-500/30 transition-colors cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground">{gameTime}</p>
            <div className="flex gap-1">
              {hasArb && (
                <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">
                  ARB
                </Badge>
              )}
              {hasEv && (
                <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                  +EV
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <TeamLine
              team={event.away_team}
              bestOdds={bestAway?.price}
              bestBook={bestAway?.bookmaker}
            />
            <TeamLine
              team={event.home_team}
              bestOdds={bestHome?.price}
              bestBook={bestHome?.bookmaker}
              isHome
            />
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            {h2hOdds.length} casas con odds
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function TeamLine({
  team,
  bestOdds,
  bestBook,
  isHome,
}: {
  team: string;
  bestOdds?: number;
  bestBook?: string;
  isHome?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isHome && (
          <span className="text-[10px] text-muted-foreground font-medium">
            HOME
          </span>
        )}
        <span className="text-sm font-medium">{team}</span>
      </div>
      {bestOdds != null && (
        <div className="text-right">
          <span className="text-sm font-mono font-bold text-green-400">
            {formatOdds(bestOdds)}
          </span>
          {bestBook && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {BOOKMAKERS[bestBook]?.name ?? bestBook}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function findBestOdds(
  odds: LatestOdds[],
  teamName: string
): { price: number; bookmaker: string } | null {
  let best: { price: number; bookmaker: string } | null = null;
  for (const row of odds) {
    const outcome = (row.outcomes as Outcome[]).find((o) => o.name === teamName);
    if (outcome && (!best || outcome.price > best.price)) {
      best = { price: outcome.price, bookmaker: row.bookmaker_key };
    }
  }
  return best;
}
