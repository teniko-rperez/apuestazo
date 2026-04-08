"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BetCard } from "@/components/recommendations/bet-card";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useArbitrageOpportunities, useEvOpportunities } from "@/hooks/use-arbitrage";
import { useEvents, useApiUsage } from "@/hooks/use-odds";
import { SPORTS } from "@/lib/constants";

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <p className={`text-2xl font-bold mt-1 ${color ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ApiUsageMeter() {
  const { data } = useApiUsage();
  if (!data) return null;

  const used = data.total - data.remaining;
  const pct = (used / data.total) * 100;

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Presupuesto API
        </p>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-2xl font-bold">{data.remaining}</span>
          <span className="text-sm text-muted-foreground mb-0.5">
            / {data.total}
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SportSummary({ sportKey }: { sportKey: string }) {
  const sport = SPORTS[sportKey as keyof typeof SPORTS];
  const { data: events, isLoading } = useEvents(sportKey);

  if (isLoading) return <Skeleton className="h-20" />;

  const todayGames = (events ?? []).filter((e) => {
    const d = new Date(e.commence_time);
    return d.toDateString() === new Date().toDateString();
  });

  return (
    <Link href={`/${sportKey === "basketball_nba" ? "nba" : "mlb"}`}>
      <Card className="hover:border-green-500/30 transition-colors cursor-pointer">
        <CardContent className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sport.emoji}</span>
            <div>
              <p className="font-semibold">{sport.name}</p>
              <p className="text-sm text-muted-foreground">
                {todayGames.length} juegos hoy
              </p>
            </div>
          </div>
          <Badge variant="secondary">{events?.length ?? 0} proximos</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { data: recs, isLoading: recsLoading } = useRecommendations(undefined, 6);
  const { data: arbs } = useArbitrageOpportunities();
  const { data: evs } = useEvOpportunities();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Analisis en tiempo real de apuestas deportivas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Arbitrajes Activos"
          value={arbs?.length ?? 0}
          color="text-yellow-400"
        />
        <StatCard
          title="Oportunidades +EV"
          value={evs?.length ?? 0}
          color="text-green-400"
        />
        <StatCard
          title="Recomendaciones"
          value={recs?.length ?? 0}
          color="text-blue-400"
        />
        <ApiUsageMeter />
      </div>

      {/* Sports */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Deportes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SportSummary sportKey="basketball_nba" />
          <SportSummary sportKey="baseball_mlb" />
        </div>
      </div>

      {/* Top Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Mejores Apuestas de Hoy</h2>
          <Link
            href="/valor"
            className="text-sm text-green-400 hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {recsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : recs && recs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recs.map((rec) => (
              <BetCard key={rec.id} rec={rec} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No hay recomendaciones activas. Las oportunidades se actualizan
                cada 30 minutos.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
