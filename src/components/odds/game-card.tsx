"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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

  return (
    <Link href={`/${sportPath}/${event.id}`}>
      <div className={`bg-white rounded-2xl p-3 shadow-sm border border-border/50 active:scale-[0.98] transition-transform ${event.completed ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-400 font-medium">{time}</span>
          <div className="flex gap-1">
            {event.completed && <Badge className="bg-gray-100 text-gray-500 text-[9px] h-4 px-1.5">FINAL</Badge>}
            {hasArb && <Badge className="bg-yellow-100 text-yellow-700 text-[9px] h-4 px-1.5 font-bold">ARB</Badge>}
            {hasEv && <Badge className="bg-blue-100 text-blue-700 text-[9px] h-4 px-1.5 font-bold">+EV</Badge>}
            {isOutdoor && <Badge className="bg-sky-100 text-sky-700 text-[9px] h-4 px-1.5">OUTDOOR</Badge>}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-800 truncate flex-1">{event.away_team}</span>
            {event.scores && <span className="text-[13px] font-bold text-gray-800 mx-2">{event.scores.away}</span>}
            {bestAway && <span className="text-[13px] font-bold text-orange-500 font-mono">{formatOdds(bestAway.price)}</span>}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-[13px] font-medium text-gray-800 truncate">{event.home_team}</span>
              <span className="text-[8px] text-blue-500 font-bold">HOME</span>
            </div>
            {event.scores && <span className="text-[13px] font-bold text-gray-800 mx-2">{event.scores.home}</span>}
            {bestHome && <span className="text-[13px] font-bold text-orange-500 font-mono">{formatOdds(bestHome.price)}</span>}
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
