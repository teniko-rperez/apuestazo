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
  const isCompleted = event.completed;
  const gameTime = new Date(event.commence_time).toLocaleString("es-ES", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const h2hOdds = odds.filter(
    (o) => o.event_id === event.id && o.market_key === "h2h"
  );

  const bestHome = findBestOdds(h2hOdds, event.home_team);
  const bestAway = findBestOdds(h2hOdds, event.away_team);

  return (
    <Link href={`/${sportPath}/${event.id}`}>
      <Card className={`hover:border-blue-500/30 transition-colors cursor-pointer ${isCompleted ? "opacity-60" : ""}`}>
        <CardContent className="pt-3 pb-3 sm:pt-4">
          <div className="flex items-start justify-between mb-2.5">
            <p className="text-[10px] sm:text-xs text-muted-foreground">{gameTime}</p>
            <div className="flex gap-1">
              {isCompleted && (
                <Badge className="bg-muted text-muted-foreground text-[10px]">
                  FINAL
                </Badge>
              )}
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

          <div className="space-y-1.5">
            <TeamLine
              team={event.away_team}
              bestOdds={bestAway?.price}
              bestBook={bestAway?.bookmaker}
              score={event.scores?.away}
            />
            <TeamLine
              team={event.home_team}
              bestOdds={bestHome?.price}
              bestBook={bestHome?.bookmaker}
              isHome
              score={event.scores?.home}
            />
          </div>

          <p className="text-[10px] text-muted-foreground mt-2.5">
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
  score,
}: {
  team: string;
  bestOdds?: number;
  bestBook?: string;
  isHome?: boolean;
  score?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {isHome && (
          <span className="text-[9px] text-blue-400/70 font-medium shrink-0">
            HOME
          </span>
        )}
        <span className="text-sm font-medium truncate">{team}</span>
        {score != null && (
          <span className="text-sm font-bold text-foreground ml-1 shrink-0">{score}</span>
        )}
      </div>
      {bestOdds != null && (
        <div className="text-right shrink-0">
          <span className="text-sm font-mono font-bold text-green-400">
            {formatOdds(bestOdds)}
          </span>
          {bestBook && (
            <span className="text-[9px] text-muted-foreground ml-1 hidden sm:inline">
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
