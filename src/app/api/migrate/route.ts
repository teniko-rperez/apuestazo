import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Check if expert_picks table exists
  const { data: existing } = await supabase
    .from('expert_picks')
    .select('id')
    .limit(1);

  if (existing !== null) {
    return NextResponse.json({ message: 'Table already exists' });
  }

  // Create table via raw SQL using rpc
  // Since we can't run raw SQL via REST, we'll create using the service client
  // The table needs to be created via SQL Editor - this endpoint verifies the status
  const sql = `
    CREATE TABLE IF NOT EXISTS expert_picks (
      id BIGSERIAL PRIMARY KEY,
      expert_name TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      sport TEXT NOT NULL,
      pick_type TEXT NOT NULL,
      pick_description TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK (confidence IN ('alta', 'media', 'baja')),
      record TEXT,
      profit_units DECIMAL(10, 2),
      scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  return NextResponse.json({
    message: 'Table expert_picks does not exist. Please run this SQL in Supabase SQL Editor:',
    sql,
  });
}
