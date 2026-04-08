import { NextResponse } from 'next/server';

export async function POST() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  try {
    // Call the cron job internally
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'https://apuestazo.vercel.app'
        : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/cron/fetch-odds`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to refresh', details: String(error) },
      { status: 500 }
    );
  }
}
