"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClient } from "@/lib/supabase/client";
import { BOOKMAKERS, MARKET_LABELS } from "@/lib/constants";
import { formatOdds } from "@/lib/analysis/implied-probability";
import type { PlayerProp, Outcome } from "@/types/odds";

function usePlayerProps() {
  return useSWR(
    "player-props",
    async () => {
      const supabase = getClient();
      const { data, error } = await supabase
        .from("player_props")
        .select("*, events(home_team, away_team, sport_key)")
        .order("fetched_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as (PlayerProp & {
        events: { home_team: string; away_team: string; sport_key: string };
      })[];
    },
    { refreshInterval: 60000 }
  );
}

export default function PropsPage() {
  const { data: props, isLoading } = usePlayerProps();

  // Group props by player + market
  const grouped = new Map<
    string,
    {
      player_name: string;
      market_key: string;
      event_label: string;
      entries: { bookmaker: string; outcomes: Outcome[] }[];
    }
  >();

  if (props) {
    for (const prop of props) {
      const key = `${prop.player_name}|${prop.market_key}|${prop.event_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          player_name: prop.player_name,
          market_key: prop.market_key,
          event_label: prop.events
            ? `${prop.events.away_team} @ ${prop.events.home_team}`
            : "",
          entries: [],
        });
      }
      grouped.get(key)!.entries.push({
        bookmaker: prop.bookmaker_key,
        outcomes: prop.outcomes as Outcome[],
      });
    }
  }

  const groups = Array.from(grouped.values());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Props de Jugadores</h1>
        <p className="text-muted-foreground text-sm">
          Comparacion de props de jugadores entre casas de apuestas
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map((group, idx) => (
            <Card key={idx}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-semibold">{group.player_name}</span>
                  <Badge variant="secondary">
                    {MARKET_LABELS[group.market_key] ?? group.market_key}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {group.event_label}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Casa</TableHead>
                        <TableHead className="text-center">Over</TableHead>
                        <TableHead className="text-center">Under</TableHead>
                        <TableHead className="text-center">Linea</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.entries.map((entry, i) => {
                        const over = entry.outcomes.find(
                          (o) => o.name === "Over"
                        );
                        const under = entry.outcomes.find(
                          (o) => o.name === "Under"
                        );
                        const line = over?.point ?? under?.point;

                        return (
                          <TableRow key={i}>
                            <TableCell
                              className="text-sm"
                              style={{
                                color:
                                  BOOKMAKERS[entry.bookmaker]?.color ??
                                  undefined,
                              }}
                            >
                              {BOOKMAKERS[entry.bookmaker]?.name ??
                                entry.bookmaker}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {over ? formatOdds(over.price) : "-"}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {under ? formatOdds(under.price) : "-"}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {line ?? "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No hay datos de props de jugadores disponibles. Los props se
              obtienen selectivamente para ahorrar creditos del API.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
