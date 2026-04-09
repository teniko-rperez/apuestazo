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
  { id: 13, name: "Back-to-Back / Fatiga", icon: "😴", source: "ESPN schedule", description: "Equipos jugando en back-to-back (<28h descanso) rinden 3-5% menos. El oponente descansado tiene ventaja.", weight: "Media (0.14)", apiKey: false, status: "active" },
  { id: 14, name: "Home/Away", icon: "🏟️", source: "Historico", description: "NBA equipos ganan 58% en casa, MLB 54%. Ventaja de cancha/campo aplicada a todos los juegos.", weight: "Baja (0.08)", apiKey: false, status: "active" },
  { id: 15, name: "Pace of Play", icon: "⏱️", source: "NBA stats", description: "Ritmo de juego (posesiones/48min). Fast pace = mas puntos = OVER. Slow pace = UNDER. Senal #1 para totals.", weight: "Alta (0.16)", apiKey: false, status: "active" },
  { id: 16, name: "Altitude / Park Factor", icon: "⛰️", source: "Hardcoded", description: "Coors Field (5,280ft): bola viaja 5-10% mas lejos = OVER. Park factors de 0.91 a 1.38 por estadio MLB.", weight: "Media-Alta (0.12-0.20)", apiKey: false, status: "active" },
  { id: 17, name: "Head-to-Head", icon: "🤝", source: "ESPN", description: "Historial directo entre equipos. Algunos matchups favorecen consistentemente a un equipo.", weight: "Baja (0.10)", apiKey: false, status: "beta" },
  { id: 18, name: "Closing Line Value", icon: "📉", source: "Odds snapshots", description: "Compara odds de apertura vs actuales. Si la linea se movio a tu favor = sharps de acuerdo contigo.", weight: "Alta (0.18)", apiKey: false, status: "active" },
  { id: 19, name: "Streaks / Regresion", icon: "🔥", source: "Resultados recientes", description: "Rachas calientes/frias y deteccion de regresion. Equipos con >75% win rate en ultimos 10 juegos tienden a regresar.", weight: "Baja (0.10-0.12)", apiKey: false, status: "active" },
  { id: 20, name: "Playoff Motivation", icon: "🏆", source: "Standings", description: "Equipos peleando por playoffs muestran motivacion elevada. Eliminados descansan jugadores.", weight: "Media (0.12-0.14)", apiKey: false, status: "active" },
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
          "Back-to-Back / Fatiga": ["FATIGUE", "back-to-back", "REST"],
          "Home/Away": ["HOME", "home"],
          "Pace of Play": ["PACE", "pace"],
          "Altitude / Park Factor": ["ALTITUDE", "Coors", "park factor"],
          "Head-to-Head": ["H2H", "head-to-head"],
          "Closing Line Value": ["CLV", "linea abrio"],
          "Streaks / Regresion": ["STREAK", "REGRESSION", "racha"],
          "Playoff Motivation": ["PLAYOFF", "TANK", "motivacion"],
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

function useLearningHistory() {
  return useSWR("learning-history", async () => {
    const s = getClient();
    const { data } = await s.from("learning_history").select("*").order("created_at", { ascending: false }).limit(10);
    return (data ?? []) as Array<{
      id: number;
      config: Record<string, unknown>;
      signal_changes: Record<string, { from: number; to: number; reason: string }>;
      bets_analyzed: number;
      win_rate: number;
      created_at: string;
    }>;
  });
}

export default function EnginePage() {
  const { data: stats } = useEngineStats();
  const { data: history } = useLearningHistory();

  return (
    <div>
      <h1 className="text-base lg:text-xl font-bold text-gray-800 mt-1 mb-1">Engine Matrix</h1>
      <p className="text-[11px] text-gray-400 mb-4">
        {SIGNALS.length} senales + auto-aprendizaje para encontrar las apuestas mas seguras
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

      {/* Learning History */}
      <div className="mt-6">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide mb-3 px-1">
          Auto-Aprendizaje {history && history.length > 0 && <span className="text-orange-500 normal-case">({history.length} updates)</span>}
        </h2>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50 mb-3">
          <h3 className="text-[12px] font-bold text-gray-700 mb-2">Como Aprende</h3>
          <div className="space-y-1.5 text-[11px] text-gray-500 leading-relaxed">
            <p><span className="font-bold text-blue-600">1.</span> Analiza todas las apuestas liquidadas (ganadas/perdidas)</p>
            <p><span className="font-bold text-blue-600">2.</span> Calcula win rate por cada senal individual</p>
            <p><span className="font-bold text-blue-600">3.</span> Senales con {">"} 60% win rate = peso aumentado, {"<"} 40% = peso reducido</p>
            <p><span className="font-bold text-blue-600">4.</span> Encuentra combos ganadores y perdedores</p>
            <p><span className="font-bold text-blue-600">5.</span> Ajusta confianza minima para crear apuestas</p>
            <p><span className="font-bold text-blue-600">6.</span> Cancela apuestas pendientes que no cumplan los nuevos umbrales</p>
          </div>
        </div>

        {history && history.length > 0 ? (
          <div className="space-y-2">
            {history.map((h) => {
              const config = h.config as Record<string, unknown>;
              const changes = h.signal_changes ?? {};
              const changeCount = Object.keys(changes).length;
              const bestCombos = (config.best_combos as string[]) ?? [];
              const worstCombos = (config.worst_combos as string[]) ?? [];

              return (
                <div key={h.id} className="bg-white rounded-2xl p-3 shadow-sm border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-400">
                      {new Date(h.created_at).toLocaleString("es-PR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-600">{h.bets_analyzed} analizadas</span>
                      <span className={`text-[10px] font-bold ${h.win_rate >= 0.5 ? "text-green-600" : "text-red-500"}`}>
                        {(h.win_rate * 100).toFixed(0)}% win rate
                      </span>
                    </div>
                  </div>

                  {changeCount > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-bold text-gray-600 mb-1">Cambios de peso ({changeCount}):</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(changes).map(([signal, change]) => (
                          <span key={signal} className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                            change.to > change.from ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                          }`}>
                            {signal}: {change.to > change.from ? "↑" : "↓"} {(change.to * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 text-[9px]">
                    <span className="text-gray-400">Min conf: {((config.min_confidence as number) * 100).toFixed(0)}%</span>
                    <span className="text-gray-400">Min senales: {config.min_signals as number}</span>
                    <span className="text-gray-400">Min cats: {config.min_categories as number}</span>
                  </div>

                  {bestCombos.length > 0 && (
                    <p className="text-[9px] text-green-600 mt-1">Mejores combos: {bestCombos.join(', ')}</p>
                  )}
                  {worstCombos.length > 0 && (
                    <p className="text-[9px] text-red-500 mt-0.5">Evitar combos: {worstCombos.join(', ')}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-border/50">
            <p className="text-[12px] text-gray-400">El aprendizaje comienza cuando haya suficientes apuestas liquidadas (5+).</p>
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}
