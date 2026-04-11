"use client";

import { useState } from "react";
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
  arbitrage: "bg-yellow-100 text-yellow-600",
  ev: "bg-blue-100 text-blue-700",
  value: "bg-blue-100 text-blue-700",
  parlay_leg: "bg-purple-100 text-purple-600",
};

export function BetCard({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false);
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
  const isFavorite = rec.odds < 0;

  return (
    <Card className="hover:border-blue-200 transition-colors">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className={TYPE_COLORS[rec.type] ?? ""}>
            {TYPE_LABELS[rec.type] ?? rec.type}
          </Badge>
          <svg
            className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        <CardTitle className="text-sm font-medium mt-2">
          {rec.event
            ? `${rec.event.away_team} vs ${rec.event.home_team}`
            : "Evento"}
        </CardTitle>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Ganador:</p>
          <p className="text-base font-bold">{rec.outcome_name}</p>
          {isFavorite && (
            <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
              FAV
            </span>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {sport && (
                <span className="text-sm">
                  {sport.emoji} {sport.name}
                </span>
              )}
              {gameTime && <span className="text-xs text-muted-foreground">{gameTime}</span>}
            </div>
            <ConfidenceMeter score={rec.confidence_score} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-muted-foreground">
                {MARKET_LABELS[rec.market_key] ?? rec.market_key}
              </p>
              <p className="text-xs text-muted-foreground">
                {bookmaker?.name ?? rec.bookmaker_key}
              </p>
            </div>
            <p className="text-lg font-bold text-blue-600">{formatOdds(rec.odds)}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {rec.reasoning}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
