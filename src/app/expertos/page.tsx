"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfidenceMeter } from "@/components/recommendations/confidence-meter";
import { getClient } from "@/lib/supabase/client";

interface ExpertPick {
  id: number;
  expert_name: string;
  source: string;
  source_url: string;
  sport: string;
  pick_type: string;
  pick_description: string;
  confidence: "alta" | "media" | "baja";
  record: string;
  profit_units: number | null;
  scraped_at: string;
}

function useExpertPicks(sport?: string) {
  return useSWR(
    `expert-picks-${sport ?? "all"}`,
    async () => {
      const supabase = getClient();
      let query = supabase
        .from("expert_picks")
        .select("*")
        .order("scraped_at", { ascending: false })
        .limit(50);

      if (sport) {
        query = query.eq("sport", sport);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ExpertPick[];
    },
    { refreshInterval: 120000 }
  );
}

const SOURCE_COLORS: Record<string, string> = {
  "Covers.com": "bg-blue-500/20 text-blue-400",
  "Reddit r/sportsbook": "bg-orange-500/20 text-orange-400",
  WagerTalk: "bg-purple-500/20 text-purple-400",
};

function ExpertPickCard({ pick }: { pick: ExpertPick }) {
  const confScore =
    pick.confidence === "alta" ? 0.85 : pick.confidence === "media" ? 0.7 : 0.5;

  return (
    <Card className="hover:border-blue-500/30 transition-colors">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-sm">{pick.expert_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className={SOURCE_COLORS[pick.source] ?? ""}
              >
                {pick.source}
              </Badge>
              <span className="text-xs text-muted-foreground uppercase">
                {pick.sport}
              </span>
            </div>
          </div>
          <ConfidenceMeter score={confScore} />
        </div>

        <p className="text-sm mt-2">{pick.pick_description}</p>

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>Record: {pick.record}</span>
          {pick.profit_units != null && (
            <span
              className={
                pick.profit_units > 0 ? "text-orange-400" : "text-red-400"
              }
            >
              {pick.profit_units > 0 ? "+" : ""}
              {pick.profit_units} unidades
            </span>
          )}
          {pick.source_url && (
            <a
              href={pick.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Ver fuente
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExpertosPage() {
  const { data: allPicks, isLoading } = useExpertPicks();
  const { data: nbaPicks } = useExpertPicks("nba");
  const { data: mlbPicks } = useExpertPicks("mlb");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Picks de Expertos</h1>
        <p className="text-muted-foreground text-sm">
          Picks de los mejores handicappers y comunidades con records verificados
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Fuentes Monitoreadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <p>Covers.com Leaderboard</p>
              <p>Reddit r/sportsbook</p>
              <p>Handicappers verificados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Picks Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">
              {allPicks?.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Ultima Actualizacion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {allPicks?.[0]?.scraped_at
                ? new Date(allPicks[0].scraped_at).toLocaleString("es-ES")
                : "Sin datos aun"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="nba">NBA</TabsTrigger>
          <TabsTrigger value="mlb">MLB</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PicksList picks={allPicks} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="nba">
          <PicksList picks={nbaPicks} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="mlb">
          <PicksList picks={mlbPicks} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PicksList({
  picks,
  isLoading,
}: {
  picks: ExpertPick[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!picks || picks.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No hay picks de expertos disponibles. Se actualizan con cada
            ejecucion del cron job.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {picks.map((pick) => (
        <ExpertPickCard key={pick.id} pick={pick} />
      ))}
    </div>
  );
}
