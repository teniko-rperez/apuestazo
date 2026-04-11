"use client";

import { useState } from "react";
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
  const [open, setOpen] = useState(false);
  const h2h = odds.filter((o) => o.event_id === event.id && o.market_key === "h2h");
  const isOutdoor = event.sport_key === 'baseball_mlb' && OUTDOOR_TEAMS.has(event.home_team);
  const bestHome = findBest(h2h, event.home_team);
  const bestAway = findBest(h2h, event.away_team);
  const homeFav = bestHome && bestAway && bestHome.price < bestAway.price;
  const awayFav = bestHome && bestAway && bestAway.price < bestHome.price;
  const favoriteTeam = homeFav ? event.home_team : awayFav ? event.away_team : null;
  const time = new Date(event.commence_time).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
  const date = new Date(event.commence_time).toLocaleDateString("es-PR", { weekday: "short", month: "short", day: "numeric" });

  const statusLabel = event.completed ? "FINAL" : "PROXIMO";
  const statusBg = event.completed ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600";
  const statusDot = event.completed ? "bg-gray-400" : "bg-blue-500";

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover ${event.completed ? "opacity-60" : ""}`}>
      <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusDot}`} />
            <span className={`text-[11px] font-bold ${statusBg} px-2 py-0.5 rounded-md`}>{statusLabel}</span>
          </div>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        <p className="text-[13px] text-gray-600 mb-2">{event.away_team} vs {event.home_team}</p>

        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 font-medium uppercase">Ganador:</p>
          <p className="text-[16px] font-bold text-gray-900">{favoriteTeam ?? "—"}</p>
          {favoriteTeam && (
            <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">FAV</span>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center justify-between mt-3 mb-3">
            <span className="text-[11px] text-gray-500 font-medium">{date} &middot; {time}</span>
            <div className="flex gap-1.5">
              {hasArb && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">ARB</span>}
              {hasEv && <span className="text-[9px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">+EV</span>}
              {isOutdoor && <span className="text-[9px] font-bold text-sky-700 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded">OUTDOOR</span>}
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-700">{event.away_team}</span>
              <div className="flex items-center gap-3">
                {event.scores && <span className="text-base font-extrabold text-gray-900 font-mono">{event.scores.away}</span>}
                {bestAway && <span className="text-[13px] font-extrabold text-orange-500 font-mono">{formatOdds(bestAway.price)}</span>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-700">{event.home_team} <span className="text-[10px] text-blue-500 font-semibold">HOME</span></span>
              <div className="flex items-center gap-3">
                {event.scores && <span className="text-base font-extrabold text-gray-900 font-mono">{event.scores.home}</span>}
                {bestHome && <span className="text-[13px] font-extrabold text-orange-500 font-mono">{formatOdds(bestHome.price)}</span>}
              </div>
            </div>
          </div>

          <Link href={`/${sportPath}/${event.id}`} onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-orange-500 font-semibold hover:text-orange-600 flex items-center gap-1">
            Ver detalles
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      )}
    </div>
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
