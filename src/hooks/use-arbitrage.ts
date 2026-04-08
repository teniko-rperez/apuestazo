"use client";

import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";
import type { ArbitrageOpportunity, EvOpportunity } from "@/types/arbitrage";

export function useArbitrageOpportunities(sport?: string) {
  return useSWR(
    `arbs-${sport ?? "all"}`,
    async () => {
      const supabase = getClient();
      const query = supabase
        .from("arbitrage_opportunities")
        .select("*, events(home_team, away_team, commence_time, sport_key)")
        .eq("status", "active")
        .order("profit_margin", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      let results = (data ?? []) as unknown as ArbitrageOpportunity[];
      if (sport) {
        results = results.filter((r) => r.event?.sport_key === sport);
      }
      return results;
    },
    { refreshInterval: 60000 }
  );
}

export function useEvOpportunities(sport?: string) {
  return useSWR(
    `evs-${sport ?? "all"}`,
    async () => {
      const supabase = getClient();
      const { data, error } = await supabase
        .from("ev_opportunities")
        .select("*, events(home_team, away_team, commence_time, sport_key)")
        .eq("status", "active")
        .order("edge_pct", { ascending: false });

      if (error) throw error;

      let results = (data ?? []) as unknown as EvOpportunity[];
      if (sport) {
        results = results.filter((r) => r.event?.sport_key === sport);
      }
      return results;
    },
    { refreshInterval: 60000 }
  );
}
