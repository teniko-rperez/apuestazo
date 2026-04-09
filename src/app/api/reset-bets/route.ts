import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Delete all simulated bets
  const { error, count } = await supabase
    .from('simulated_bets')
    .delete()
    .gte('id', 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also clear recommendations so fresh ones are generated
  await supabase.from('recommendations').delete().gte('id', 0);

  // Clear learning history to start fresh with FAVORITO
  await supabase.from('learning_history').delete().gte('id', 0);

  return NextResponse.json({ success: true, deleted_bets: count });
}
