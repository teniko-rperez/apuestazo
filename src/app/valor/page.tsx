"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceMeter } from "@/components/recommendations/confidence-meter";
import { useEvOpportunities } from "@/hooks/use-arbitrage";
import { useRecommendations } from "@/hooks/use-recommendations";
import { BetCard } from "@/components/recommendations/bet-card";
import { BOOKMAKERS, MARKET_LABELS, SPORTS } from "@/lib/constants";
import { formatOdds, formatPct } from "@/lib/analysis/implied-probability";

export default function ValorPage() {
  const { data: evs, isLoading: evsLoading } = useEvOpportunities();
  const { data: parlayRecs } = useRecommendations("parlay_leg");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Apuestas con Valor (+EV)</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Apuestas donde las odds ofrecidas son mejores que las odds justas
        </p>
      </div>

      {/* EV Opportunities */}
      {evsLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : evs && evs.length > 0 ? (
        <div className="space-y-3">
          {evs.map((ev) => {
            const sport = ev.event?.sport_key
              ? SPORTS[ev.event.sport_key as keyof typeof SPORTS]
              : null;
            const confidenceScore =
              ev.confidence === "alta"
                ? 0.85
                : ev.confidence === "media"
                  ? 0.7
                  : 0.55;

            return (
              <Card
                key={ev.id}
                className="hover:border-blue-500/30 transition-colors"
              >
                <CardContent className="pt-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {sport && <span>{sport.emoji}</span>}
                        <span className="text-sm font-medium">
                          {ev.event
                            ? `${ev.event.away_team} @ ${ev.event.home_team}`
                            : "Evento"}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {MARKET_LABELS[ev.market_key] ?? ev.market_key}
                        </Badge>
                      </div>
                      <p className="font-semibold">{ev.outcome_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {BOOKMAKERS[ev.bookmaker_key]?.name ?? ev.bookmaker_key}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Odds</p>
                        <p className="font-mono font-bold text-green-400 text-sm">
                          {formatOdds(ev.odds)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Justas
                        </p>
                        <p className="font-mono text-muted-foreground text-sm">
                          {formatOdds(ev.fair_odds)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Ventaja
                        </p>
                        <p className="font-mono font-bold text-green-400 text-sm">
                          {formatPct(ev.edge_pct)}
                        </p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-xs text-muted-foreground">Kelly</p>
                        <p className="font-mono text-sm">
                          {formatPct(ev.kelly_fraction)}
                        </p>
                      </div>
                      <ConfidenceMeter score={confidenceScore} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No hay oportunidades +EV activas en este momento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Parlay Suggestions */}
      {parlayRecs && parlayRecs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Parlays Sugeridos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parlayRecs.map((rec) => (
              <BetCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
