"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BOOKMAKERS, MARKET_LABELS, SPORTS } from "@/lib/constants";
import { formatOdds, formatPct } from "@/lib/analysis/implied-probability";
import type { ArbitrageOpportunity } from "@/types/arbitrage";

export function ArbCard({ arb }: { arb: ArbitrageOpportunity }) {
  const sport = arb.event?.sport_key
    ? SPORTS[arb.event.sport_key as keyof typeof SPORTS]
    : null;

  return (
    <Card className="border-yellow-500/30 hover:border-yellow-500/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {sport && <span>{sport.emoji}</span>}
            <CardTitle className="text-sm">
              {arb.event
                ? `${arb.event.away_team} @ ${arb.event.home_team}`
                : "Evento"}
            </CardTitle>
          </div>
          <Badge className="bg-yellow-100 text-yellow-600 font-bold">
            +{formatPct(arb.profit_margin)} garantizado
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {MARKET_LABELS[arb.market_key] ?? arb.market_key}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {arb.legs.map((leg, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{leg.outcome_name}</p>
                <p className="text-xs text-muted-foreground">
                  {BOOKMAKERS[leg.bookmaker]?.name ?? leg.bookmaker}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold text-blue-600">
                  {formatOdds(leg.odds)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPct(leg.stake_pct)} del bankroll
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
