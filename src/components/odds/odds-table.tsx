"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BOOKMAKERS, MARKET_LABELS } from "@/lib/constants";
import { formatOdds } from "@/lib/analysis/implied-probability";
import { cn } from "@/lib/utils";
import type { LatestOdds, Outcome } from "@/types/odds";

interface OddsTableProps {
  odds: LatestOdds[];
  marketKey: string;
}

export function OddsTable({ odds, marketKey }: OddsTableProps) {
  const filtered = odds.filter((o) => o.market_key === marketKey);
  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No hay datos de odds disponibles para {MARKET_LABELS[marketKey] ?? marketKey}
      </p>
    );
  }

  // Get all unique outcomes
  const outcomeNames = new Set<string>();
  for (const row of filtered) {
    for (const o of row.outcomes as Outcome[]) {
      outcomeNames.add(o.name);
    }
  }
  const outcomes = Array.from(outcomeNames);

  // Get bookmakers that have data
  const bookmakerKeys = [...new Set(filtered.map((r) => r.bookmaker_key))];

  // Find best odds per outcome
  const bestOdds = new Map<string, number>();
  for (const name of outcomes) {
    let best = -Infinity;
    for (const row of filtered) {
      const outcome = (row.outcomes as Outcome[]).find((o) => o.name === name);
      if (outcome && outcome.price > best) {
        best = outcome.price;
      }
    }
    bestOdds.set(name, best);
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">
              {MARKET_LABELS[marketKey] ?? marketKey}
            </TableHead>
            {bookmakerKeys.map((bk) => (
              <TableHead key={bk} className="text-center min-w-[90px]">
                <span
                  className="text-xs"
                  style={{ color: BOOKMAKERS[bk]?.color }}
                >
                  {BOOKMAKERS[bk]?.name ?? bk}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {outcomes.map((outcomeName) => (
            <TableRow key={outcomeName}>
              <TableCell className="font-medium text-sm">
                {outcomeName}
              </TableCell>
              {bookmakerKeys.map((bk) => {
                const row = filtered.find((r) => r.bookmaker_key === bk);
                const outcome = row
                  ? (row.outcomes as Outcome[]).find(
                      (o) => o.name === outcomeName
                    )
                  : null;
                const isBest =
                  outcome && outcome.price === bestOdds.get(outcomeName);

                return (
                  <TableCell key={bk} className="text-center">
                    {outcome ? (
                      <span
                        className={cn(
                          "text-sm font-mono",
                          isBest
                            ? "text-orange-500 font-bold"
                            : "text-foreground"
                        )}
                      >
                        {formatOdds(outcome.price)}
                        {outcome.point != null && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({outcome.point > 0 ? "+" : ""}
                            {outcome.point})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
