"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BOOKMAKERS, MARKET_LABELS } from "@/lib/constants";
import { formatOdds, formatPct } from "@/lib/analysis/implied-probability";
import type { ArbitrageOpportunity } from "@/types/arbitrage";

export function ArbCard({ arb }: { arb: ArbitrageOpportunity }) {
  const [open, setOpen] = useState(false);
  const favoriteLeg = arb.legs.reduce((best, leg) => (best == null || leg.odds < best.odds ? leg : best), arb.legs[0] ?? null);
  const ganador = favoriteLeg?.outcome_name ?? "—";
  const isFavorite = favoriteLeg != null && favoriteLeg.odds < 0;

  return (
    <Card className="border-yellow-500/30 hover:border-yellow-500/50 transition-colors overflow-hidden">
      <CardHeader className="pb-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <div className="flex items-center justify-between mb-2">
          <Badge className="bg-yellow-100 text-yellow-600 font-bold">
            ARBITRAJE +{formatPct(arb.profit_margin)}
          </Badge>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        <p className="text-[13px] text-gray-600 mb-1">
          {arb.event ? `${arb.event.away_team} vs ${arb.event.home_team}` : "Evento"}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 font-medium uppercase">Ganador:</p>
          <p className="text-[16px] font-bold text-gray-900">{ganador}</p>
          {isFavorite && (
            <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">FAV</span>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            {MARKET_LABELS[arb.market_key] ?? arb.market_key}
          </p>
          <div className="space-y-2">
            {arb.legs.map((leg, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{leg.outcome_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {BOOKMAKERS[leg.bookmaker]?.name ?? leg.bookmaker}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-blue-600">{formatOdds(leg.odds)}</p>
                  <p className="text-xs text-muted-foreground">{formatPct(leg.stake_pct)} del bankroll</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
