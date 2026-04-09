import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import webpush from 'web-push';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, body, url } = await request.json();

    webpush.setVapidDetails(
      'mailto:developers@tenikopr.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const supabase = createServiceClient();
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription');

    let sent = 0;
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify({ title, body, url })
        );
        sent++;
      } catch {
        // Remove invalid subscriptions
        await supabase.from('push_subscriptions')
          .delete()
          .eq('endpoint', (sub.subscription as { endpoint: string }).endpoint);
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
