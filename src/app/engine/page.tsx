"use client";

import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";

interface SignalDef {
  id: number;
  name: string;
  key: string;
  source: string;
  description: string;
  rawWeight: number;
  apiKey: boolean;
  status: "active" | "beta";
}

const SIGNALS: SignalDef[] = [
  { id: 1, key: "FAVORITO", name: "Favorito", source: "Odds de todas las casas", description: "Identifica al equipo favorito por probabilidad implicita de las odds. La senal mas importante - el favorito gana la mayoria de los juegos.", rawWeight: 0.50, apiKey: false, status: "active" },
  { id: 2, key: "ARB", name: "Arbitraje", source: "Multi-bookmaker", description: "Encuentra combinaciones de apuestas en diferentes casas que garantizan ganancia sin importar el resultado.", rawWeight: 0.25, apiKey: false, status: "active" },
  { id: 3, key: "STEAM", name: "Steam Moves", source: "Line tracking", description: "Detecta cuando 3+ casas mueven las lineas en la misma direccion. Indica dinero inteligente.", rawWeight: 0.20, apiKey: false, status: "active" },
  { id: 4, key: "LINE_MOVE", name: "Line Movement", source: "Odds snapshots", description: "Monitorea cambios significativos en las lineas entre snapshots.", rawWeight: 0.10, apiKey: false, status: "active" },
  { id: 5, key: "EXPERT", name: "Expert Consensus", source: "Covers, Reddit, Twitter/X", description: "Agrega picks de handicappers verificados. 2+ expertos coincidiendo fortalece la senal.", rawWeight: 0.18, apiKey: false, status: "active" },
  { id: 6, key: "DISCREPANCY", name: "Odds Discrepancies", source: "Cross-book comparison", description: "Compara odds entre 6 bookmakers. Discrepancias >30pts indican opinion divergente.", rawWeight: 0.12, apiKey: false, status: "active" },
  { id: 7, key: "CONTRARIAN", name: "Contrarian Value", source: "ESPN public betting %", description: "Cuando el publico apuesta pesado (>65%), el otro lado tiene valor historico.", rawWeight: 0.10, apiKey: false, status: "active" },
  { id: 8, key: "ROBINHOOD", name: "Robinhood/Kalshi", source: "Kalshi public API", description: "Precios de contratos de prediccion como probabilidades implicitas del mercado.", rawWeight: 0.16, apiKey: false, status: "active" },
  { id: 9, key: "STATS", name: "Team Stats", source: "balldontlie + MLB Stats", description: "Win%, puntos promedio, racha reciente. Metodo Log5 para probabilidad.", rawWeight: 0.16, apiKey: true, status: "active" },
  { id: 10, key: "WEATHER", name: "Weather", source: "Open-Meteo", description: "Viento, lluvia, temperatura para juegos MLB outdoor.", rawWeight: 0.12, apiKey: false, status: "active" },
  { id: 11, key: "POLYMARKET", name: "Polymarket", source: "Polymarket CLOB API", description: "Mercado de predicciones crypto con traders sofisticados.", rawWeight: 0.14, apiKey: false, status: "active" },
  { id: 12, key: "INJURY", name: "Lesiones Estrellas", source: "ESPN injuries API", description: "Detecta jugadores estrella OUT, DOUBTFUL o QUESTIONABLE. Si estrellas del rival estan fuera, es ventaja masiva. Peso alto por impacto directo.", rawWeight: 0.20, apiKey: false, status: "active" },
  { id: 13, key: "FATIGUE", name: "Fatiga / B2B", source: "ESPN schedule", description: "Back-to-back (<28h descanso) = 3-5% menos rendimiento.", rawWeight: 0.14, apiKey: false, status: "active" },
  { id: 14, key: "HOME", name: "Home/Away", source: "Historico", description: "NBA 58% home win, MLB 54%. Ventaja de cancha aplicada.", rawWeight: 0.08, apiKey: false, status: "active" },
  { id: 15, key: "PACE", name: "Pace of Play", source: "NBA stats", description: "Ritmo de juego. Fast pace = OVER, slow = UNDER.", rawWeight: 0.16, apiKey: false, status: "active" },
  { id: 16, key: "ALTITUDE", name: "Park Factor", source: "Hardcoded", description: "Coors Field +10% runs. Park factors por estadio MLB.", rawWeight: 0.14, apiKey: false, status: "active" },
  { id: 17, key: "H2H", name: "Head-to-Head", source: "ESPN", description: "Historial directo entre equipos en matchups.", rawWeight: 0.10, apiKey: false, status: "beta" },
  { id: 18, key: "CLV", name: "Closing Line Value", source: "Odds snapshots", description: "Odds apertura vs actuales. Movimiento a tu favor = sharps contigo.", rawWeight: 0.18, apiKey: false, status: "active" },
  { id: 19, key: "STREAK", name: "Streaks / Regresion", source: "Resultados recientes", description: "Rachas calientes/frias y deteccion de regresion a la media.", rawWeight: 0.10, apiKey: false, status: "active" },
  { id: 20, key: "PLAYOFF", name: "Playoff Motivation", source: "Standings", description: "Equipos peleando por playoffs vs eliminados.", rawWeight: 0.14, apiKey: false, status: "active" },
];

const TOTAL_RAW_WEIGHT = SIGNALS.reduce((s, sig) => s + sig.rawWeight, 0);

function useEngineStats() {
  return useSWR("engine-stats", async () => {
    const s = getClient();
    const { data: recs } = await s.from("recommendations").select("reasoning").gte("valid_until", new Date().toISOString());
    const { data: bets } = await s.from("simulated_bets").select("result, profit");

    const signalCounts: Record<string, number> = {};
    for (const r of recs ?? []) {
      const reasoning = (r.reasoning as string) ?? "";
      for (const sig of SIGNALS) {
        const patterns: Record<string, string[]> = {
          "Favorito": ["FAVORITO", "Favorito"], "Arbitraje": ["ARB"], "Steam Moves": ["STEAM"],
          "Line Movement": ["LINE_MOVE"], "Expert Consensus": ["EXPERT"], "Odds Discrepancies": ["DISCREPANCY"],
          "Contrarian Value": ["CONTRARIAN"], "Robinhood/Kalshi": ["ROBINHOOD", "Kalshi"],
          "Team Stats": ["STATS"], "Weather": ["WEATHER"], "Polymarket": ["POLYMARKET"],
          "Injuries": ["INJURY"], "Fatiga / B2B": ["FATIGUE", "REST"], "Home/Away": ["HOME"],
          "Pace of Play": ["PACE"], "Park Factor": ["ALTITUDE", "Coors"],
          "Head-to-Head": ["H2H"], "Closing Line Value": ["CLV"],
          "Streaks / Regresion": ["STREAK", "REGRESSION"], "Playoff Motivation": ["PLAYOFF", "TANK"],
        };
        if ((patterns[sig.name] ?? []).some((k) => reasoning.toLowerCase().includes(k.toLowerCase()))) {
          signalCounts[sig.name] = (signalCounts[sig.name] ?? 0) + 1;
        }
      }
    }

    const betsList = (bets ?? []) as Array<Record<string, unknown>>;
    return {
      signalCounts, totalRecs: (recs ?? []).length,
      totalBets: betsList.length,
      wonBets: betsList.filter((b) => b.result === "won").length,
      profit: betsList.reduce((s, b) => s + ((b.profit as number) ?? 0), 0),
    };
  });
}

function useLearningHistory() {
  return useSWR("learning-history", async () => {
    const s = getClient();
    const { data } = await s.from("learning_history").select("*").order("created_at", { ascending: false }).limit(10);
    return (data ?? []) as Array<{
      id: number; config: Record<string, unknown>;
      signal_changes: Record<string, { from: number; to: number; reason: string }>;
      bets_analyzed: number; win_rate: number; created_at: string;
    }>;
  });
}

export default function EnginePage() {
  const { data: stats } = useEngineStats();
  const { data: history } = useLearningHistory();

  const latestConfig = history?.[0]?.config as Record<string, unknown> | undefined;
  const latestLearnedWeights = latestConfig?.signal_weights as Record<string, number> | undefined;
  const latestAvoidSignals = latestConfig?.avoid_signals as string[] | undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">Engine Matrix</h1>
        <p className="text-sm text-gray-500 mt-1">
          {SIGNALS.length} senales + auto-aprendizaje
          {latestLearnedWeights && <span className="text-orange-500 font-semibold"> (pesos ajustados)</span>}
        </p>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-2xl p-5 mb-6 text-white">
        <h2 className="text-[14px] font-bold mb-3">Como Funciona</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { step: "1", title: "Recoleccion", desc: "Cada 15min, 8+ fuentes" },
            { step: "2", title: "Senales", desc: "20 indicadores independientes" },
            { step: "3", title: "Correlacion", desc: "Multi-senal = mas confianza" },
            { step: "4", title: "Scoring", desc: "2x multiplicador con 4+ senales" },
          ].map((s) => (
            <div key={s.step} className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center mb-2">
                <span className="text-[11px] font-black text-orange-400">{s.step}</span>
              </div>
              <p className="text-[12px] font-bold">{s.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance stats */}
      {stats && stats.totalBets > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "RECS ACTIVAS", value: stats.totalRecs, color: "text-gray-900" },
            { label: "WIN RATE", value: `${stats.totalBets > 0 ? ((stats.wonBets / stats.totalBets) * 100).toFixed(0) : 0}%`, color: "text-gray-900" },
            { label: "PROFIT", value: `${stats.profit >= 0 ? "+" : ""}$${stats.profit.toFixed(0)}`, color: stats.profit >= 0 ? "text-emerald-600" : "text-red-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <p className={`text-lg font-extrabold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Signals Grid */}
      <h2 className="text-lg font-bold text-gray-900 mb-3">Senales ({SIGNALS.length})</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {SIGNALS.map((sig) => {
          const count = stats?.signalCounts[sig.name] ?? 0;
          const learnedWeight = latestLearnedWeights?.[sig.key];
          const effectiveWeight = learnedWeight ?? sig.rawWeight;
          const effectiveTotal = latestLearnedWeights
            ? SIGNALS.reduce((s, si) => s + (latestLearnedWeights[si.key] ?? si.rawWeight), 0)
            : TOTAL_RAW_WEIGHT;
          const pct = (effectiveWeight / effectiveTotal) * 100;
          const isAvoided = latestAvoidSignals?.includes(sig.key);
          const changed = learnedWeight != null && Math.abs(learnedWeight - sig.rawWeight) > 0.01;

          return (
            <div key={sig.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${isAvoided ? "border-red-200" : "border-gray-100"} card-hover`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-gray-900">#{sig.id} {sig.name}</span>
                  {sig.status === "beta" && (
                    <span className="text-[8px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">BETA</span>
                  )}
                  {isAvoided && (
                    <span className="text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">EVITAR</span>
                  )}
                </div>
                {count > 0 && (
                  <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">{count} activas</span>
                )}
              </div>
              <p className="text-[10px] text-blue-500 font-semibold mb-1">{sig.source}</p>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{sig.description}</p>

              {/* Weight bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isAvoided ? "bg-red-400" : pct >= 8 ? "bg-gradient-to-r from-orange-400 to-orange-500" : pct >= 5 ? "bg-blue-400" : "bg-gray-300"}`}
                    style={{ width: `${Math.min(pct * 5, 100)}%` }}
                  />
                </div>
                <span className={`text-[13px] font-extrabold font-mono min-w-[45px] text-right ${isAvoided ? "text-red-500" : "text-orange-600"}`}>
                  {pct.toFixed(1)}%
                </span>
                {changed && (
                  <span className={`text-[10px] font-bold ${(learnedWeight ?? 0) > sig.rawWeight ? "text-emerald-600" : "text-red-500"}`}>
                    {(learnedWeight ?? 0) > sig.rawWeight ? "▲" : "▼"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#0f172a] rounded-xl px-4 py-2.5 text-center mb-8">
        <span className="text-[11px] text-slate-400 font-bold">TOTAL = 100.0%</span>
        {latestLearnedWeights && <span className="text-[10px] text-orange-400 ml-2">Ajustado por auto-aprendizaje</span>}
      </div>

      {/* Learning History */}
      <h2 className="text-lg font-bold text-gray-900 mb-3">
        Auto-Aprendizaje
        {history && history.length > 0 && <span className="text-orange-500 text-sm font-medium ml-2">({history.length} updates)</span>}
      </h2>

      {history && history.length > 0 ? (
        <div className="space-y-3">
          {history.map((h) => {
            const config = h.config as Record<string, unknown>;
            const changes = h.signal_changes ?? {};
            const changeCount = Object.keys(changes).length;
            const bestCombos = (config.best_combos as string[]) ?? [];
            const worstCombos = (config.worst_combos as string[]) ?? [];

            return (
              <div key={h.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500 font-medium">
                    {new Date(h.created_at).toLocaleString("es-PR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-gray-600">{h.bets_analyzed} analizadas</span>
                    <span className={`text-[11px] font-extrabold font-mono px-2 py-0.5 rounded ${h.win_rate >= 0.5 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {(h.win_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {changeCount > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-bold text-gray-600 mb-1.5">Cambios de peso ({changeCount}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(changes).map(([signal, change]) => (
                        <span key={signal} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          change.to > change.from ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
                        }`}>
                          {signal} {change.to > change.from ? "▲" : "▼"} {(change.to * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 text-[10px] text-gray-500">
                  <span>Conf: {((config.min_confidence as number) * 100).toFixed(0)}%</span>
                  <span>Senales: {config.min_signals as number}+</span>
                  <span>Cats: {config.min_categories as number}+</span>
                </div>

                {bestCombos.length > 0 && (
                  <p className="text-[10px] text-emerald-600 font-medium mt-2">Mejores: {bestCombos.join(', ')}</p>
                )}
                {worstCombos.length > 0 && (
                  <p className="text-[10px] text-red-500 font-medium mt-0.5">Evitar: {worstCombos.join(', ')}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <p className="text-[13px] text-gray-400">El aprendizaje comienza con 5+ apuestas liquidadas</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
