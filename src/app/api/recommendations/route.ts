import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

  const supabase = createServiceClient();

  let query = supabase
    .from('recommendations')
    .select('*, events(home_team, away_team, commence_time, sport_key)')
    .gte('valid_until', new Date().toISOString())
    .order('confidence_score', { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
