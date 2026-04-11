import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  try {
    const headersList = await headers();

    // Require auth: bearer token OR Vercel cron header
    const auth = headersList.get('authorization');
    const isVercelCron = headersList.get('x-vercel-cron') === '1';
    if (!isVercelCron && auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const host = headersList.get('host') ?? 'apuestazo.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(`${baseUrl}/api/cron/fetch-odds`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to refresh', details: String(error) }, { status: 500 });
  }
}
