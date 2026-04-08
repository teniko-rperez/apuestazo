import { SupabaseClient } from '@supabase/supabase-js';
import { MONTHLY_CREDIT_LIMIT, EMERGENCY_CREDIT_THRESHOLD } from '../constants';

export async function getRemainingCredits(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('get_remaining_credits');
  if (error) {
    console.error('Error getting remaining credits:', error);
    return 0; // fail safe: assume no credits left
  }
  return data ?? MONTHLY_CREDIT_LIMIT;
}

export async function logApiUsage(
  supabase: SupabaseClient,
  endpoint: string,
  creditsUsed: number,
  sportKey?: string,
  markets?: string[]
): Promise<void> {
  const { error } = await supabase.from('api_usage').insert({
    endpoint,
    credits_used: creditsUsed,
    sport_key: sportKey,
    markets,
  });
  if (error) {
    console.error('Error logging API usage:', error);
  }
}

export function canAffordRequest(remainingCredits: number, cost: number): boolean {
  return remainingCredits >= cost;
}

export function isEmergencyMode(remainingCredits: number): boolean {
  return remainingCredits < EMERGENCY_CREDIT_THRESHOLD;
}

export function estimateCost(markets: string[]): number {
  // Each market per region = 1 credit. We use 1 region (us)
  return markets.length;
}
