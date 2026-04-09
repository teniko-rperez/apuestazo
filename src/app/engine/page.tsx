"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { getClient } from "@/lib/supabase/client";

interface SignalDef {
  id: number;
  name: string;
  icon: string;
  source: string;
  description: string;
  weight: string;
  apiKey: boolean;
  status: "active" | "beta";
}

const SIGNALS: SignalDef[] = [
  { id: 1, name: "+EV Edge", icon: "📊", source: "The Odds API + ESPN", description: "Detecta apuestas donde las odds ofrecidas son mejores que las odds justas. Usa power devig para eliminar el vig y encontrar valor real.", weight: "Alta (0.30 alta, 0.20 media, 0.12 baja)", apiKey: true, status: "active" },
  { id: 2, name: "Arbitraje", icon: "💰", source: "Multi-bookmaker", description: "Encuentra combinaciones de apuestas en diferentes casas que garantizan ganancia sin importar el resultado. Requiere 2+ bookmakers.", weight: "Alta (0.25)", apiKey: false, status: "active" },
  { id: 3, name: "Steam Moves", icon: "🔥", source: "Line tracking", description: "Detecta cuando 3+ casas de apuestas mueven las lineas en la misma direccion simultaneamente. Indica dinero inteligente (sharp money).", weight: "Alta (0.18-0.25)", apiKey: false, status: "active" },
  { id: 4, name: "Line Movement", icon: "📈", source: "Odds snapshots", description: "Monitorea cambios significativos en las lineas. Movimiento a la baja en odds = el mercado cree que ese resultado es mas probable.", weight: "Baja (0.10)", apiKey: false, status: "active" },
  { id: 5, name: "Expert Consensus", icon: "👥", source: "Covers, Reddit, Twitter/X", description: "Agrega picks de handicappers verificados y comunidades de apuestas. Cuando 2+ expertos coinciden en un pick, la senal se fortalece.", weight: "Media (0.15-0.22)", apiKey: false, status: "active" },
  { id: 6, name: "Odds Discrepancies", icon: "⚡", source: "Cross-book comparison", description: "Compara odds entre 6 bookmakers. Discrepancias >30 centavos indican que una casa tiene una opinion diferente al mercado.", weight: "Baja (0.12)", apiKey: false, status: "active" },
  { id: 7, name: "Contrarian Value", icon: "🔄", source: "ESPN public betting %", description: "Cuando el publico apuesta pesado en un lado (>65%), el otro lado historicamente tiene valor. Fade the public.", weight: "Baja (0.10)", apiKey: false, status: "active" },
  { id: 8, name: "Robinhood/Kalshi", icon: "📱", source: "Kalshi public API", description: "Precios de contratos de prediccion que representan probabilidades implicitas del mercado. Compara vs sportsbooks para encontrar edge.", weight: "Media (0.12-0.22)", apiKey: false, status: "active" },
  { id: 9, name: "Team Stats", icon: "📋", source: "balldontlie + MLB Stats API", description: "Win%, puntos promedio, racha reciente. Usa metodo Log5 para estimar probabilidad de victoria basada en stats.", weight: "Media (0.14-0.20)", apiKey: true, status: "active" },
  { id: 10, name: "Weather", icon: "🌦️", source: "Open-Meteo (gratis)", description: "Para juegos MLB outdoor: viento >15mph y lluvia >40% favorecen Under. Temperatura extrema afecta rendimiento.", weight: "Baja (0.12)", apiKey: false, status: "active" },
  { id: 11, name: "Polymarket", icon: "🔮", source: "Polymarket CLOB API", description: "Mercado de predicciones crypto. Precios reflejan consenso de traders sofisticados sobre probabilidades de eventos.", weight: "Baja (0.12-0.18)", apiKey: false, status: "active" },
  { id: 12, name: "Injuries", icon: "🏥", source: "ESPN injuries API", description: "Monitorea jugadores lesionados, cuestionables o fuera. Un star player out puede mover lineas 3-5 puntos.", weight: "Media (0.15-0.22)", apiKey: false, status: "beta" },
];

function useEngineStats() {
  return useSWR("engine-stats", async () => {
    const s = getClient();
    const { data: recs } = await s.from("recommendations").select("reasoning").gte("valid_until", new Date().toISOString());
    const { data: bets } = await s.from("simulated_bets").select("result, profit");

    // Count signal mentions in recommendations
    const signalCounts: Record<string, number> = {};
    for (const r of recs ?? []) {
      const reasoning = (r.reasoning as string) ?? "";
      for (const sig of SIGNALS) {
        const patterns: Record<string, string[]> = {
          "+EV Edge": ["+EV", "EV"],
          "Arbitraje": ["ARB", "arbitraje"],
          "Steam Moves": ["STEAM", "steam"],
          "Line Movement": ["LINE_MOVE", "linea se movio"],
          "Expert Consensus": ["EXPERT", "expertos"],
          "Odds Discrepancies": ["DISCREPANCY", "discrepancia"],
          "Contrarian Value": ["CONTRARIAN", "contrario"],
          "Robinhood/Kalshi": ["ROBINHOOD", "Kalshi"],
          "Team Stats": ["STATS", "win%"],
          "Weather": ["WEATHER", "clima"],
          "Polymarket": ["POLYMARKET", "Polymarket"],
          "Injuries": ["INJURY", "lesion"],
        };
        const keys = patterns[sig.name] ?? [sig.name];
        if (keys.some((k) => reasoning.toLowerCase().includes(k.toLowerCase()))) {
          signalCounts[sig.name] = (signalCounts[sig.name] ?? 0) + 1;
        }
      }
    }

    const betsList = (bets ?? []) as Array<Record<string, unknown>>;
    const totalBets = betsList.length;
    const wonBets = betsList.filter((b) => b.result === "won").length;
    const profit = betsList.reduce((s, b) => s + ((b.profit as number) ?? 0), 0);

    return { signalCounts, totalRecs: (recs ?? []).length, totalBets, wonBets, profit };
  });
}

export default function EnginePage() {
  const { data: stats } = useEngineStats();

  return (
    <div>
      <h1 className="text-base lg:text-xl font-bold text-gray-800 mt-1 mb-1">Engine Matrix</h1>
      <p className="text-[11px] text-gray-400 mb-4">
        {SIGNALS.length} senales correlacionadas para encontrar las apuestas mas seguras
      </p>

      {/* How it works */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50 mb-4">
        <h2 className="text-[13px] font-bold text-gray-800 mb-2">Como Funciona</h2>
        <div className="space-y-2 text-[11px] text-gray-600 leading-relaxed">
          <p><span className="font-bold text-blue-600">1. Recoleccion:</span> Cada 30 min scrapeamos 8+ fuentes de datos (ESPN, Kalshi, Reddit, Covers, etc.)</p>
          <p><span className="font-bold text-blue-600">2. Senales:</span> Cada fuente genera senales independientes por equipo/mercado</p>
          <p><span className="font-bold text-blue-600">3. Correlacion:</span> Cuando multiples senales coinciden en el mismo resultado, la confianza sube exponencialmente</p>
          <p><span className="font-bold text-blue-600">4. Scoring:</span> 1 senal = 1x, 2 senales = 1.4x, 3 senales = 1.8x, 4+ senales = 2.0x multiplicador</p>
          <p><span className="font-bold text-orange-500">Mas senales de acuerdo = apuesta mas segura</span></p>
        </div>
      </div>

      {/* Performance */}
      {stats && stats.totalBets > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          <div className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
            <p className="text-[14px] font-bold font-mono text-gray-800">{stats.totalRecs}</p>
            <p className="text-[9px] text-gray-400 font-semibold">RECS ACTIVAS</p>
          </div>
          <div className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
            <p className="text-[14px] font-bold font-mono text-gray-800">
              {stats.totalBets > 0 ? ((stats.wonBets / stats.totalBets) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-[9px] text-gray-400 font-semibold">WIN RATE</p>
          </div>
          <div className="bg-white rounded-xl py-2 text-center shadow-sm border border-border/50">
            <p className={`text-[14px] font-bold font-mono ${stats.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
              {stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(0)}
            </p>
            <p className="text-[9px] text-gray-400 font-semibold">PROFIT</p>
          </div>
        </div>
      )}

      {/* Signals Grid */}
      <div className="space-y-2">
        {SIGNALS.map((sig) => {
          const count = stats?.signalCounts[sig.name] ?? 0;
          return (
            <div key={sig.id} className="bg-white rounded-2xl p-3 shadow-sm border border-border/50">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{sig.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-bold text-gray-800">#{sig.id} {sig.name}</span>
                    {sig.status === "beta" && (
                      <Badge className="bg-purple-100 text-purple-600 text-[8px] h-4 px-1">BETA</Badge>
                    )}
                    {sig.apiKey && (
                      <Badge className="bg-gray-100 text-gray-500 text-[8px] h-4 px-1">API KEY</Badge>
                    )}
                    {count > 0 && (
                      <Badge className="bg-orange-100 text-orange-600 text-[8px] h-4 px-1">{count} activas</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-blue-600 font-medium mb-1">{sig.source}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{sig.description}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Peso: {sig.weight}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-4" />
    </div>
  );
}
