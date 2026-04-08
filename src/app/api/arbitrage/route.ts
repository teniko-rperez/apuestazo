import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const minProfit = parseFloat(searchParams.get('minProfit') ?? '0');

  const supabase = createServiceClient();

  let query = supabase
    .from('arbitrage_opportunities')
    .select('*, events(home_team, away_team, commence_time, sport_key)')
    .eq('status', 'active')
    .order('profit_margin', { ascending: false });

  if (minProfit > 0) {
    query = query.gte('profit_margin', minProfit);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by sport if requested
  let results = data ?? [];
  if (sport) {
    results = results.filter(
      (r: Record<string, unknown>) =>
        (r.events as Record<string, unknown>)?.sport_key === sport
    );
  }

  return NextResponse.json(results);
}
