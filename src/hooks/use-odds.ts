"use client";

import useSWR from "swr";
import { getClient } from "@/lib/supabase/client";
import type { GameEvent } from "@/types/event";
import type { LatestOdds } from "@/types/odds";

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchEvents(sportKey: string): Promise<GameEvent[]> {
  const supabase = getClient();
  const { start, end } = todayRange();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("sport_key", sportKey)
    .gte("commence_time", start)
    .lte("commence_time", end)
    .order("commence_time", { ascending: true });

  if (error) throw error;
  return (data as GameEvent[]) ?? [];
}

async function fetchEventOdds(eventId: string): Promise<LatestOdds[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("latest_odds")
    .select("*")
    .eq("event_id", eventId);

  if (error) throw error;
  return (data as unknown as LatestOdds[]) ?? [];
}

async function fetchAllOddsForSport(sportKey: string): Promise<LatestOdds[]> {
  const supabase = getClient();
  const events = await fetchEvents(sportKey);
  const eventIds = events.map((e) => e.id);
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from("latest_odds")
    .select("*")
    .in("event_id", eventIds);

  if (error) throw error;
  return (data as unknown as LatestOdds[]) ?? [];
}

export function useEvents(sportKey: string) {
  return useSWR(`events-${sportKey}`, () => fetchEvents(sportKey), {
    refreshInterval: 60000,
  });
}

export function useEventOdds(eventId: string | null) {
  return useSWR(
    eventId ? `odds-${eventId}` : null,
    () => fetchEventOdds(eventId!),
    { refreshInterval: 60000 }
  );
}

export function useSportOdds(sportKey: string) {
  return useSWR(`sport-odds-${sportKey}`, () => fetchAllOddsForSport(sportKey), {
    refreshInterval: 60000,
  });
}

export function useEvent(eventId: string) {
  return useSWR(`event-${eventId}`, async () => {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (error) throw error;
    return data as GameEvent;
  });
}

export function useApiUsage() {
  return useSWR("api-usage", async () => {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("get_remaining_credits");
    if (error) throw error;
    return { remaining: data as number, total: 500 };
  });
}
