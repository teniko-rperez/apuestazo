"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { getClient } from "@/lib/supabase/client";
import { BOOKMAKERS, MARKET_LABELS, SPORTS } from "@/lib/constants";
import { formatOdds } from "@/lib/analysis/implied-probability";
import { cn } from "@/lib/utils";

interface SimulatedBet {
  id: number;
  event_id: string;
  market_key: string;
  outcome_name: string;
  bookmaker_key: string;
  odds: number;
  stake: number;
  source: string;
  reasoning: string;
  result: "pending" | "won" | "lost" | "push";
  profit: number | null;
  placed_at: string;
  settled_at: string | null;
  events?: {
    home_team: string;
    away_team: string;
    commence_time: string;
    sport_key: string;
    completed: boolean;
    scores: { home: number; away: number } | null;
  };
}

function useSimulatedBets() {
  return useSWR(
    "simulated-bets",
    async () => {
      const supabase = getClient();
      const { data, error } = await supabase
        .from("simulated_bets")
        .select(
          "*, events(home_team, away_team, commence_time, sport_key, completed, scores)"
        )
        .order("placed_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as SimulatedBet[];
    },
    { refreshInterval: 30000 }
  );
}

const RESULT_STYLES: Record<string, string> = {
  won: "bg-green-500/20 text-green-400",
  lost: "bg-red-500/20 text-red-400",
  push: "bg-yellow-500/20 text-yellow-400",
  pending: "bg-blue-500/20 text-blue-400",
};

const RESULT_LABELS: Record<string, string> = {
  won: "GANADA",
  lost: "PERDIDA",
  push: "EMPATE",
  pending: "PENDIENTE",
};

const RESULT_EMOJI: Record<string, string> = {
  won: "W",
  lost: "L",
  push: "P",
  pending: "...",
};

const SOURCE_LABELS: Record<string, string> = {
  arbitrage: "Arbitraje",
  ev: "+EV",
  value: "Valor",
  parlay_leg: "Parlay",
};

export default function SimulacionesPage() {
  const { data: bets, isLoading } = useSimulatedBets();

  const totalBets = bets?.length ?? 0;
  const wonBets = bets?.filter((b: SimulatedBet) => b.result === "won").length ?? 0;
  const lostBets = bets?.filter((b: SimulatedBet) => b.result === "lost").length ?? 0;
  const pendingBets = bets?.filter((b: SimulatedBet) => b.result === "pending").length ?? 0;
  const settledBets = totalBets - pendingBets;
  const totalProfit = bets?.reduce((sum: number, b: SimulatedBet) => sum + (b.profit ?? 0), 0) ?? 0;
  const winRate =
    settledBets > 0 ? ((wonBets / settledBets) * 100).toFixed(1) : "0.0";
  const roi =
    settledBets > 0
      ? ((totalProfit / (settledBets * 100)) * 100).toFixed(1)
      : "0.0";

  // Group bets by event
  const gameGroups = new Map<
    string,
    { event: SimulatedBet["events"]; bets: SimulatedBet[] }
  >();
  for (const bet of bets ?? []) {
    const key = bet.event_id;
    if (!gameGroups.has(key)) {
      gameGroups.set(key, { event: bet.events, bets: [] });
    }
    gameGroups.get(key)!.bets.push(bet);
  }
  const games = Array.from(gameGroups.entries());

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Apuestas Simuladas</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          $100 por apuesta en la mejor recomendacion de cada juego
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
        <StatBox label="Total" value={totalBets} />
        <StatBox label="Ganadas" value={wonBets} color="text-green-400" />
        <StatBox label="Perdidas" value={lostBets} color="text-red-400" />
        <StatBox label="Pendientes" value={pendingBets} color="text-blue-400" />
        <StatBox label="Win Rate" value={`${winRate}%`} />
        <StatBox
          label="Ganancia"
          value={`${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(0)}`}
          color={totalProfit >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* ROI bar */}
      {settledBets > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                ROI ({settledBets} apuestas liquidadas)
              </span>
              <span
                className={cn(
                  "font-bold font-mono",
                  parseFloat(roi) >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {parseFloat(roi) >= 0 ? "+" : ""}
                {roi}%
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  parseFloat(roi) >= 0 ? "bg-green-500" : "bg-red-500"
                )}
                style={{
                  width: `${Math.min(100, Math.abs(parseFloat(roi)) * 2 + 50)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Games list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : games.length > 0 ? (
        <div className="space-y-3">
          {games.map(([eventId, group]) => (
            <GameBetCard
              key={eventId}
              eventId={eventId}
              event={group.event}
              bets={group.bets}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No hay apuestas simuladas aun. Dale clic a &quot;Actualizar&quot;
              para analizar los juegos y generar apuestas simuladas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GameBetCard({
  eventId,
  event,
  bets,
}: {
  eventId: string;
  event: SimulatedBet["events"];
  bets: SimulatedBet[];
}) {
  const sport = event?.sport_key
    ? SPORTS[event.sport_key as keyof typeof SPORTS]
    : null;
  const sportPath = event?.sport_key === "basketball_nba" ? "nba" : "mlb";
  const gameTime = event?.commence_time
    ? new Date(event.commence_time).toLocaleString("es-ES", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const gameProfit = bets.reduce((sum, b) => sum + (b.profit ?? 0), 0);
  const allSettled = bets.every((b) => b.result !== "pending");
  const anyWon = bets.some((b) => b.result === "won");

  return (
    <Card
      className={cn(
        "transition-colors",
        allSettled && anyWon && "border-green-500/20",
        allSettled && !anyWon && gameProfit < 0 && "border-red-500/20"
      )}
    >
      <CardContent className="pt-3 pb-3 sm:pt-4">
        {/* Game header */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <Link
              href={`/${sportPath}/${eventId}`}
              className="hover:underline"
            >
              <p className="text-sm font-semibold truncate">
                {sport && <span className="mr-1">{sport.emoji}</span>}
                {event
                  ? `${event.away_team} @ ${event.home_team}`
                  : "Evento"}
              </p>
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {gameTime}
              </span>
              {event?.scores && (
                <span className="text-xs font-mono font-bold">
                  {event.scores.away} - {event.scores.home}
                </span>
              )}
              {event?.completed && (
                <Badge className="bg-muted text-muted-foreground text-[9px]">
                  FINAL
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            {allSettled ? (
              <p
                className={cn(
                  "text-sm font-bold font-mono",
                  gameProfit >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {gameProfit >= 0 ? "+" : ""}${gameProfit.toFixed(2)}
              </p>
            ) : (
              <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">
                EN JUEGO
              </Badge>
            )}
          </div>
        </div>

        <Separator className="mb-2" />

        {/* Bets for this game */}
        <div className="space-y-1.5">
          {bets.map((bet) => (
            <div
              key={bet.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                    RESULT_STYLES[bet.result]
                  )}
                >
                  {RESULT_EMOJI[bet.result]}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {MARKET_LABELS[bet.market_key] ?? bet.market_key}
                </span>
                <span className="font-medium truncate">
                  {bet.outcome_name}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[9px] hidden sm:inline-flex"
                >
                  {SOURCE_LABELS[bet.source] ?? bet.source}
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-muted-foreground hidden sm:inline">
                  {BOOKMAKERS[bet.bookmaker_key]?.name ?? bet.bookmaker_key}
                </span>
                <span className="font-mono font-bold">
                  {formatOdds(bet.odds)}
                </span>
                <span
                  className={cn(
                    "font-mono font-bold w-16 text-right",
                    bet.profit != null
                      ? bet.profit >= 0
                        ? "text-green-400"
                        : "text-red-400"
                      : "text-muted-foreground"
                  )}
                >
                  {bet.profit != null
                    ? `${bet.profit >= 0 ? "+" : ""}$${bet.profit.toFixed(0)}`
                    : RESULT_LABELS[bet.result]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Reasoning */}
        {bets[0]?.reasoning && (
          <p className="text-[10px] text-muted-foreground mt-2 line-clamp-1">
            {bets[0].reasoning}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-2.5 pb-2.5 sm:pt-3 text-center">
        <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p
          className={cn(
            "text-lg sm:text-xl font-bold mt-0.5 font-mono",
            color
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
