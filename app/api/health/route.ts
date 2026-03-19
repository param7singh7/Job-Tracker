import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'ireland-data-analytics-job-radar',
    timestamp: new Date().toISOString()
  });
}
