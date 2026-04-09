"use client";

import Link from "next/link";
import { formatOdds } from "@/lib/analysis/implied-probability";
import type { GameEvent } from "@/types/event";
import type { LatestOdds, Outcome } from "@/types/odds";

const OUTDOOR_TEAMS = new Set([
  'New York Yankees', 'New York Mets', 'Boston Red Sox', 'Los Angeles Dodgers',
  'San Francisco Giants', 'Chicago Cubs', 'Chicago White Sox', 'Philadelphia Phillies',
  'Atlanta Braves', 'Washington Nationals', 'Cleveland Guardians', 'Detroit Tigers',
  'Baltimore Orioles', 'Cincinnati Reds', 'Pittsburgh Pirates', 'St. Louis Cardinals',
  'Kansas City Royals', 'Colorado Rockies', 'San Diego Padres', 'Minnesota Twins',
  'Los Angeles Angels', 'Oakland Athletics',
]);

interface GameCardProps {
  event: GameEvent;
  odds: LatestOdds[];
  sportPath: string;
  hasArb?: boolean;
  hasEv?: boolean;
}

export function GameCard({ event, odds, sportPath, hasArb, hasEv }: GameCardProps) {
  const h2h = odds.filter((o) => o.event_id === event.id && o.market_key === "h2h");
  const isOutdoor = event.sport_key === 'baseball_mlb' && OUTDOOR_TEAMS.has(event.home_team);
  const bestHome = findBest(h2h, event.home_team);
  const bestAway = findBest(h2h, event.away_team);
  const time = new Date(event.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
  const date = new Date(event.commence_time).toLocaleDateString("es-PR", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Link href={`/${sportPath}/${event.id}`}>
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover ${event.completed ? "opacity-60" : ""}`}>
        {/* Header bar */}
        <div className="px-4 py-2 bg-gray-50/80 flex items-center justify-between border-b border-gray-100">
          <span className="text-[11px] text-gray-500 font-medium">{date} &middot; {time}</span>
          <div className="flex gap-1.5">
            {event.completed && (
              <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded">FINAL</span>
            )}
            {hasArb && (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">ARB</span>
            )}
            {hasEv && (
              <span className="text-[9px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">+EV</span>
            )}
            {isOutdoor && (
              <span className="text-[9px] font-bold text-sky-700 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded">OUTDOOR</span>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="p-4 space-y-3">
          {/* Away team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-black text-gray-400">VS</span>
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 truncate">{event.away_team}</p>
                <p className="text-[10px] text-gray-400">Visitante</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {event.scores && <span className="text-xl font-extrabold text-gray-900 font-mono">{event.scores.away}</span>}
              {bestAway && (
                <span className="text-[15px] font-extrabold text-orange-500 font-mono bg-orange-50 px-2 py-1 rounded-lg">
                  {formatOdds(bestAway.price)}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-100" />

          {/* Home team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 truncate">{event.home_team}</p>
                <p className="text-[10px] text-blue-500 font-semibold">HOME</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {event.scores && <span className="text-xl font-extrabold text-gray-900 font-mono">{event.scores.home}</span>}
              {bestHome && (
                <span className="text-[15px] font-extrabold text-orange-500 font-mono bg-orange-50 px-2 py-1 rounded-lg">
                  {formatOdds(bestHome.price)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function findBest(odds: LatestOdds[], team: string): { price: number } | null {
  let best: { price: number } | null = null;
  for (const r of odds) {
    const o = (r.outcomes as Outcome[]).find((x) => x.name === team);
    if (o && (!best || o.price > best.price)) best = { price: o.price };
  }
  return best;
}
