"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useArbitrageOpportunities, useEvOpportunities } from "@/hooks/use-arbitrage";
import { useEvents, useSportOdds } from "@/hooks/use-odds";
import { BOOKMAKERS, MARKET_LABELS } from "@/lib/constants";
import { formatOdds, formatPct } from "@/lib/analysis/implied-probability";
import type { GameEvent } from "@/types/event";
import type { LatestOdds, Outcome } from "@/types/odds";
import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";

/* ─── Game Row ─── */
function GameRow({ event, odds }: { event: GameEvent; odds: LatestOdds[] }) {
  const h2h = odds.filter(
    (o) => o.event_id === event.id && o.market_key === "h2h"
  );

  function bestOdds(teamName: string) {
    let best: { price: number; book: string } | null = null;
    for (const row of h2h) {
      const o = (row.outcomes as Outcome[]).find((x) => x.name === teamName);
      if (o && (!best || o.price > best.price))
        best = { price: o.price, book: row.bookmaker_key };
    }
    return best;
  }

  const homeOdds = bestOdds(event.home_team);
  const awayOdds = bestOdds(event.away_team);
  const time = new Date(event.commence_time).toLocaleTimeString("es-PR", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Link href={`/${event.sport_key === "basketball_nba" ? "nba" : "mlb"}/${event.id}`}>
      <Card className="active:scale-[0.98] transition-transform">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">
              {event.sport_key === "basketball_nba" ? "🏀 NBA" : "⚾ MLB"}
            </span>
            {event.completed ? (
              <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5">
                FINAL
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground">{time}</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-medium truncate">
                {event.away_team}
              </span>
              {event.scores && (
                <span className="text-sm font-bold">{event.scores.away}</span>
              )}
            </div>
            {awayOdds && (
              <div className="text-right ml-2">
                <span className="text-sm font-mono font-bold text-orange-400">
                  {formatOdds(awayOdds.price)}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1">
                  {BOOKMAKERS[awayOdds.book]?.name?.slice(0, 2) ?? ""}
                </span>
              </div>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-medium truncate">
                {event.home_team}
              </span>
              {event.scores && (
                <span className="text-sm font-bold">{event.scores.home}</span>
              )}
              <span className="text-[9px] text-muted-foreground">HOME</span>
            </div>
            {homeOdds && (
              <div className="text-right ml-2">
                <span className="text-sm font-mono font-bold text-orange-400">
                  {formatOdds(homeOdds.price)}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1">
                  {BOOKMAKERS[homeOdds.book]?.name?.slice(0, 2) ?? ""}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ─── Recommendation Card ─── */
function RecCard({ rec }: { rec: Record<string, unknown> }) {
  const event = rec.events as {
    home_team: string;
    away_team: string;
    sport_key: string;
  } | null;
  const confScore = rec.confidence_score as number;
  const confColor =
    confScore >= 0.8
      ? "text-orange-400"
      : confScore >= 0.6
        ? "text-yellow-400"
        : "text-orange-400";

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <Badge
            className={
              rec.type === "arbitrage"
                ? "bg-yellow-500/20 text-yellow-400 text-[10px]"
                : rec.type === "ev"
                  ? "bg-orange-500/20 text-orange-400 text-[10px]"
                  : "bg-purple-500/20 text-purple-400 text-[10px]"
            }
          >
            {rec.type === "arbitrage"
              ? "ARB"
              : rec.type === "ev"
                ? "+EV"
                : "PARLAY"}
          </Badge>
          <span className={`text-xs font-bold ${confColor}`}>
            {Math.round(confScore * 100)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {event ? `${event.away_team} @ ${event.home_team}` : ""}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-medium">
            {rec.outcome_name as string}
          </span>
          <span className="text-sm font-mono font-bold text-orange-400">
            {formatOdds(rec.odds as number)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
          {rec.reasoning as string}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Sim Bet Card ─── */
function SimBetCard({ bet }: { bet: Record<string, unknown> }) {
  const event = bet.events as {
    home_team: string;
    away_team: string;
    scores?: { home: number; away: number };
  } | null;
  const result = bet.result as string;
  const profit = bet.profit as number | null;

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge
                className={
                  result === "won"
                    ? "bg-orange-500/20 text-orange-400 text-[10px]"
                    : result === "lost"
                      ? "bg-red-500/20 text-red-400 text-[10px]"
                      : "bg-blue-500/20 text-blue-400 text-[10px]"
                }
              >
                {result === "won"
                  ? "GANADA"
                  : result === "lost"
                    ? "PERDIDA"
                    : "PENDIENTE"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {MARKET_LABELS[bet.market_key as string] ?? bet.market_key}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {event ? `${event.away_team} @ ${event.home_team}` : ""}
            </p>
            <p className="text-sm font-medium">{bet.outcome_name as string}</p>
          </div>
          <div className="text-right ml-3">
            <p className="text-sm font-mono font-bold">
              {formatOdds(bet.odds as number)}
            </p>
            {profit != null && (
              <p
                className={`text-sm font-mono font-bold ${profit >= 0 ? "text-orange-400" : "text-red-400"}`}
              >
                {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Section Header ─── */
function SectionHeader({
  title,
  count,
  href,
}: {
  title: string;
  count?: number;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-6 mb-3">
      <h2 className="text-base font-bold">
        {title}
        {count != null && count > 0 && (
          <span className="text-orange-400 ml-1.5 text-sm">({count})</span>
        )}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-blue-400">
          Ver todo
        </Link>
      )}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { data: nbaEvents, isLoading: nbaLoading } = useEvents("basketball_nba");
  const { data: mlbEvents, isLoading: mlbLoading } = useEvents("baseball_mlb");
  const { data: nbaOdds } = useSportOdds("basketball_nba");
  const { data: mlbOdds } = useSportOdds("baseball_mlb");
  const { data: recs } = useRecommendations(undefined, 5);
  const { data: arbs } = useArbitrageOpportunities();
  const { data: evs } = useEvOpportunities();

  const { data: simBets } = useSWR("sim-bets-home", async () => {
    const supabase = getClient();
    const { data } = await supabase
      .from("simulated_bets")
      .select("*, events(home_team, away_team, scores)")
      .order("placed_at", { ascending: false })
      .limit(5);
    return data ?? [];
  });

  const betsTyped = (simBets ?? []) as Array<Record<string, unknown>>;
  const totalProfit = betsTyped.reduce(
    (sum, b) => sum + ((b.profit as number) ?? 0),
    0
  );
  const wonCount = betsTyped.filter((b) => b.result === "won").length;
  const totalSettled = betsTyped.filter((b) => b.result !== "pending").length;

  const allEvents = [...(nbaEvents ?? []), ...(mlbEvents ?? [])].sort(
    (a, b) =>
      new Date(a.commence_time).getTime() -
      new Date(b.commence_time).getTime()
  );
  const allOdds = [...(nbaOdds ?? []), ...(mlbOdds ?? [])];

  const isLoading = nbaLoading || mlbLoading;

  return (
    <div className="space-y-1">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2 mt-2">
        <div className="bg-card rounded-lg p-2 text-center border border-border">
          <p className="text-lg font-bold text-yellow-400">
            {arbs?.length ?? 0}
          </p>
          <p className="text-[9px] text-muted-foreground">ARB</p>
        </div>
        <div className="bg-card rounded-lg p-2 text-center border border-border">
          <p className="text-lg font-bold text-blue-400">
            {evs?.length ?? 0}
          </p>
          <p className="text-[9px] text-muted-foreground">+EV</p>
        </div>
        <div className="bg-card rounded-lg p-2 text-center border border-border">
          <p className="text-lg font-bold">
            {wonCount}/{totalSettled}
          </p>
          <p className="text-[9px] text-muted-foreground">W/L</p>
        </div>
        <div className="bg-card rounded-lg p-2 text-center border border-border">
          <p
            className={`text-lg font-bold ${totalProfit >= 0 ? "text-orange-400" : "text-red-400"}`}
          >
            {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(0)}
          </p>
          <p className="text-[9px] text-muted-foreground">P/L</p>
        </div>
      </div>

      {/* Recommendations */}
      {recs && recs.length > 0 && (
        <>
          <SectionHeader
            title="Mejores Apuestas"
            count={recs.length}
            href="/valor"
          />
          <div className="space-y-2">
            {recs.map((rec) => (
              <RecCard key={rec.id} rec={rec as unknown as Record<string, unknown>} />
            ))}
          </div>
        </>
      )}

      {/* Games Today */}
      <SectionHeader
        title="Juegos de Hoy"
        count={allEvents.length}
      />
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : allEvents.length > 0 ? (
        <div className="space-y-2">
          {allEvents.map((event) => (
            <GameRow
              key={event.id}
              event={event}
              odds={allOdds}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No hay juegos programados. Dale "Actualizar" para buscar datos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Simulated Bets */}
      {simBets && simBets.length > 0 && (
        <>
          <SectionHeader
            title="Apuestas Simuladas"
            count={simBets.length}
            href="/simulaciones"
          />
          <div className="space-y-2">
            {betsTyped.map((bet) => (
              <SimBetCard
                key={bet.id as number}
                bet={bet}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
