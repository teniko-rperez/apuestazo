"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/lib/supabase/client";
import { BOOKMAKERS, MARKET_LABELS } from "@/lib/constants";
import { formatOdds } from "@/lib/analysis/implied-probability";

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
        .select("*, events(home_team, away_team, commence_time, sport_key, completed, scores)")
        .order("placed_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as SimulatedBet[];
    },
    { refreshInterval: 30000 }
  );
}

const RESULT_STYLES: Record<string, string> = {
  won: "bg-blue-500/20 text-blue-400",
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

const SOURCE_LABELS: Record<string, string> = {
  arbitrage: "Arbitraje",
  ev: "Valor +EV",
  expert: "Experto",
  parlay: "Parlay",
};

export default function SimulacionesPage() {
  const { data: bets, isLoading } = useSimulatedBets();

  const totalBets = bets?.length ?? 0;
  const wonBets = bets?.filter((b) => b.result === "won").length ?? 0;
  const lostBets = bets?.filter((b) => b.result === "lost").length ?? 0;
  const pendingBets = bets?.filter((b) => b.result === "pending").length ?? 0;
  const totalProfit = bets?.reduce((sum, b) => sum + (b.profit ?? 0), 0) ?? 0;
  const winRate = totalBets - pendingBets > 0
    ? ((wonBets / (totalBets - pendingBets)) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Apuestas Simuladas</h1>
        <p className="text-muted-foreground text-sm">
          Seguimiento automatico de las recomendaciones del sistema con $100 por apuesta
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase">Total</p>
            <p className="text-2xl font-bold">{totalBets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase">Ganadas</p>
            <p className="text-2xl font-bold text-blue-400">{wonBets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase">Perdidas</p>
            <p className="text-2xl font-bold text-red-400">{lostBets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase">Win Rate</p>
            <p className="text-2xl font-bold">{winRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase">Ganancia</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-orange-400" : "text-red-400"}`}>
              {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bets list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : bets && bets.length > 0 ? (
        <div className="space-y-3">
          {bets.map((bet) => (
            <Card key={bet.id} className="hover:border-border/80 transition-colors">
              <CardContent className="pt-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={RESULT_STYLES[bet.result]}>
                        {RESULT_LABELS[bet.result]}
                      </Badge>
                      <Badge variant="secondary">
                        {SOURCE_LABELS[bet.source] ?? bet.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {MARKET_LABELS[bet.market_key] ?? bet.market_key}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {bet.events
                        ? `${bet.events.away_team} @ ${bet.events.home_team}`
                        : "Evento"}
                    </p>
                    <p className="text-sm">
                      {bet.outcome_name} en{" "}
                      {BOOKMAKERS[bet.bookmaker_key]?.name ?? bet.bookmaker_key}
                    </p>
                    {bet.reasoning && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {bet.reasoning}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Odds</p>
                      <p className="font-mono font-bold">{formatOdds(bet.odds)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Stake</p>
                      <p className="font-mono">${bet.stake.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">P/L</p>
                      <p
                        className={`font-mono font-bold ${
                          bet.profit != null
                            ? bet.profit >= 0
                              ? "text-orange-400"
                              : "text-red-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {bet.profit != null
                          ? `${bet.profit >= 0 ? "+" : ""}$${bet.profit.toFixed(2)}`
                          : "-"}
                      </p>
                    </div>
                    {bet.events?.scores && (
                      <div>
                        <p className="text-xs text-muted-foreground">Score</p>
                        <p className="font-mono text-sm">
                          {bet.events.scores.away}-{bet.events.scores.home}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No hay apuestas simuladas aun. Se crean automaticamente cuando el
              sistema detecta oportunidades. Dale clic a "Actualizar" para generar datos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
