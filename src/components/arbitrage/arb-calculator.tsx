"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BOOKMAKERS } from "@/lib/constants";
import {
  americanToDecimal,
  formatOdds,
} from "@/lib/analysis/implied-probability";
import type { ArbitrageOpportunity } from "@/types/arbitrage";

export function ArbCalculator({ arb }: { arb: ArbitrageOpportunity }) {
  const [bankroll, setBankroll] = useState(100);

  const totalImplied = arb.total_implied_probability;
  const guaranteedProfit = bankroll * arb.profit_margin;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Calculadora de Stakes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <label className="text-xs text-muted-foreground block mb-1">
            Bankroll total ($)
          </label>
          <input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(Number(e.target.value) || 0)}
            className="w-full bg-muted rounded-md px-3 py-2 text-sm font-mono border border-border focus:border-blue-500 focus:outline-none"
            min={0}
          />
        </div>

        <div className="space-y-2 mb-4">
          {arb.legs.map((leg, i) => {
            const decimal = americanToDecimal(leg.odds);
            const stake = (bankroll * (1 / decimal)) / totalImplied;
            const payout = stake * decimal;

            return (
              <div
                key={i}
                className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2"
              >
                <div>
                  <p className="font-medium">{leg.outcome_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {BOOKMAKERS[leg.bookmaker]?.name ?? leg.bookmaker}{" "}
                    <span className="font-mono">{formatOdds(leg.odds)}</span>
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-bold">${stake.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    Pago: ${payout.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Ganancia garantizada:
          </span>
          <span className="text-lg font-bold text-orange-500 font-mono">
            ${guaranteedProfit.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
