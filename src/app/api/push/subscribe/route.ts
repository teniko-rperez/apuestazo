import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const subscription = await request.json();
    const supabase = createServiceClient();

    // Store subscription in Supabase
    await supabase.from('push_subscriptions').upsert(
      { endpoint: subscription.endpoint, subscription: subscription },
      { onConflict: 'endpoint' }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
