"use client";

import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";
import type { Recommendation } from "@/types/recommendation";

export function useRecommendations(type?: string, limit = 20) {
  return useSWR(
    `recs-${type ?? "all"}-${limit}`,
    async () => {
      const supabase = getClient();
      let query = supabase
        .from("recommendations")
        .select("*, events(home_team, away_team, commence_time, sport_key)")
        .gte("valid_until", new Date().toISOString())
        .order("confidence_score", { ascending: false })
        .limit(limit);

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Recommendation[];
    },
    { refreshInterval: 60000 }
  );
}
