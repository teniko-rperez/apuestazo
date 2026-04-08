import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const sportKey = searchParams.get('sport');

  const supabase = createServiceClient();

  if (eventId) {
    // Get odds for specific event
    const { data, error } = await supabase
      .from('latest_odds')
      .select('*')
      .eq('event_id', eventId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (sportKey) {
    // Get all latest odds for a sport (join with events)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .eq('sport_key', sportKey)
      .eq('completed', false)
      .gte('commence_time', new Date().toISOString());

    if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

    const eventIds = events?.map((e) => e.id) ?? [];
    if (eventIds.length === 0) return NextResponse.json([]);

    const { data, error } = await supabase
      .from('latest_odds')
      .select('*')
      .in('event_id', eventIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Provide eventId or sport parameter' }, { status: 400 });
}
