import { NextResponse } from 'next/server';
import { getSourceHealth } from '@/src/services/source-health-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getSourceHealth();
  return NextResponse.json(data);
}
