"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BOOKMAKERS, MARKET_LABELS, SPORTS } from "@/lib/constants";
import { formatOdds } from "@/lib/analysis/implied-probability";
import type { Recommendation } from "@/types/recommendation";
import { ConfidenceMeter } from "./confidence-meter";

const TYPE_LABELS: Record<string, string> = {
  arbitrage: "Arbitraje",
  ev: "Valor +EV",
  value: "Valor",
  parlay_leg: "Parlay",
};

const TYPE_COLORS: Record<string, string> = {
  arbitrage: "bg-yellow-500/20 text-yellow-400",
  ev: "bg-green-500/20 text-green-400",
  value: "bg-blue-500/20 text-blue-400",
  parlay_leg: "bg-blue-400/20 text-blue-300",
};

export function BetCard({ rec }: { rec: Recommendation }) {
  const sport = rec.event?.sport_key
    ? SPORTS[rec.event.sport_key as keyof typeof SPORTS]
    : null;
  const bookmaker = BOOKMAKERS[rec.bookmaker_key];
  const gameTime = rec.event?.commence_time
    ? new Date(rec.event.commence_time).toLocaleString("es-ES", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Card className="hover:border-blue-500/30 transition-colors">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {sport && (
              <span className="text-xs sm:text-sm">
                {sport.emoji} {sport.name}
              </span>
            )}
            <Badge
              variant="secondary"
              className={TYPE_COLORS[rec.type] ?? ""}
            >
              {TYPE_LABELS[rec.type] ?? rec.type}
            </Badge>
          </div>
          <ConfidenceMeter score={rec.confidence_score} />
        </div>
        <CardTitle className="text-xs sm:text-sm font-medium mt-1">
          {rec.event
            ? `${rec.event.away_team} @ ${rec.event.home_team}`
            : "Evento"}
        </CardTitle>
        <p className="text-[10px] sm:text-xs text-muted-foreground">{gameTime}</p>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {MARKET_LABELS[rec.market_key] ?? rec.market_key}
            </p>
            <p className="font-semibold text-sm truncate">{rec.outcome_name}</p>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-[10px] text-muted-foreground">
              {bookmaker?.name ?? rec.bookmaker_key}
            </p>
            <p className="text-lg font-bold text-green-400">
              {formatOdds(rec.odds)}
            </p>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {rec.reasoning}
        </p>
      </CardContent>
    </Card>
  );
}
