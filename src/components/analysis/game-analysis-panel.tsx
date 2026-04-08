"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/analysis/implied-probability";
import { BOOKMAKERS } from "@/lib/constants";
import { useGameAnalysis } from "@/hooks/use-game-analysis";
import type { BetAnalysis, BetSignal, GameAnalysis, MarketAnalysis } from "@/hooks/use-game-analysis";

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function GameAnalysisPanel({ eventId }: { eventId: string }) {
  const { data: analysis, isLoading, error } = useGameAnalysis(eventId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No se pudo cargar el analisis del juego.
      </p>
    );
  }

  const hasBestBet = analysis.best_bet && analysis.best_bet.signals.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card className="border-green-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Analisis del Juego</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Mercados" value={String(analysis.markets.length)} />
            <StatBox label="Senales" value={String(analysis.total_signals)} />
            <StatBox
              label="Expertos"
              value={String(analysis.expert_picks.length)}
            />
            <StatBox
              label="Arbitrajes"
              value={String(analysis.markets.filter((m: MarketAnalysis) => m.has_arb).length)}
              highlight={analysis.markets.some((m: MarketAnalysis) => m.has_arb)}
            />
          </div>

          {hasBestBet && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-xs text-green-400 font-medium mb-1">
                Mejor apuesta detectada
              </p>
              <p className="text-sm font-semibold">
                {analysis.best_bet!.market_label}: {analysis.best_bet!.outcome_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {analysis.best_bet!.recommendation}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expert picks for this game */}
      {analysis.expert_picks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expertos sobre este juego</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.expert_picks.map((ep: GameAnalysis["expert_picks"][number], i: number) => (
                <div key={i} className="flex items-start justify-between text-xs">
                  <div>
                    <span className="font-medium">{ep.expert_name}</span>
                    <span className="text-muted-foreground ml-1">({ep.source})</span>
                    <p className="text-foreground">{ep.pick_description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <ConfidenceBadge level={ep.confidence} />
                    <p className="text-muted-foreground">{ep.record}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-market analysis */}
      {analysis.markets.map((market: MarketAnalysis) => (
        <MarketCard key={market.market_key} market={market} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market card — shows all bets in a market
// ---------------------------------------------------------------------------

function MarketCard({ market }: { market: MarketAnalysis }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{market.market_label}</CardTitle>
          <div className="flex gap-1">
            {market.has_arb && (
              <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">
                ARB {market.arb_profit != null ? `${(market.arb_profit * 100).toFixed(1)}%` : ""}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {market.bets.map((bet, i) => (
          <div key={bet.outcome_name}>
            {i > 0 && <Separator className="mb-3" />}
            <BetRow bet={bet} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Individual bet analysis row
// ---------------------------------------------------------------------------

function BetRow({ bet }: { bet: BetAnalysis }) {
  return (
    <div className="space-y-2">
      {/* Header: outcome, best odds, confidence */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{bet.outcome_name}</span>
            {bet.has_value && (
              <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                +EV
              </Badge>
            )}
            {bet.confidence !== "none" && (
              <ConfidenceBadge level={bet.confidence} />
            )}
          </div>
          {bet.recommendation && (
            <p className="text-xs text-green-400/80 mt-0.5">
              {bet.recommendation}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-bold font-mono text-green-400">
            {formatOdds(bet.best_odds)}
          </span>
          <p className="text-[10px] text-muted-foreground">
            {bet.best_bookmaker_name}
          </p>
        </div>
      </div>

      {/* Probability & edge stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <MiniStat
          label="Prob. Implicita"
          value={`${(bet.implied_probability * 100).toFixed(1)}%`}
        />
        <MiniStat
          label="Prob. Justa"
          value={`${(bet.fair_probability * 100).toFixed(1)}%`}
        />
        {bet.edge_pct != null && (
          <MiniStat
            label="Ventaja"
            value={`${(bet.edge_pct * 100).toFixed(1)}%`}
            positive
          />
        )}
        {bet.kelly_fraction != null && (
          <MiniStat
            label="Kelly (1/4)"
            value={`${(bet.kelly_fraction * 100).toFixed(2)}%`}
          />
        )}
      </div>

      {/* Signals */}
      {bet.signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bet.signals.map((signal: BetSignal, i: number) => (
            <SignalPill key={i} signal={signal} />
          ))}
        </div>
      )}

      {/* Odds comparison */}
      <div className="flex flex-wrap gap-2">
        {bet.odds_by_book.map((book) => (
          <div
            key={book.bookmaker_key}
            className={cn(
              "px-2 py-1 rounded text-xs font-mono",
              book.is_best
                ? "bg-green-500/15 text-green-400 ring-1 ring-green-500/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span className="text-[10px] block" style={{ color: BOOKMAKERS[book.bookmaker_key]?.color }}>
              {book.bookmaker_name}
            </span>
            <span className={cn("font-bold", book.is_best && "text-green-400")}>
              {formatOdds(book.odds)}
            </span>
            {book.point != null && (
              <span className="text-muted-foreground ml-0.5">
                ({book.point > 0 ? "+" : ""}{book.point})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function SignalPill({ signal }: { signal: BetSignal }) {
  const colors = {
    strong: "bg-green-500/15 text-green-400 border-green-500/30",
    moderate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    weak: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn("text-[10px] px-2 py-0.5 rounded-full border", colors[signal.strength])}
      title={signal.detail}
    >
      {signal.label}: {signal.detail}
    </span>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    alta: "bg-green-500/20 text-green-400",
    media: "bg-yellow-500/20 text-yellow-400",
    baja: "bg-orange-500/20 text-orange-400",
  };
  const labels: Record<string, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  };
  return (
    <Badge className={cn("text-[10px]", colors[level] ?? "bg-muted text-muted-foreground")}>
      {labels[level] ?? level}
    </Badge>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-xl font-bold",
          highlight ? "text-yellow-400" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-muted/50 rounded px-2 py-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("font-mono font-medium", positive && "text-green-400")}>
        {value}
      </p>
    </div>
  );
}
