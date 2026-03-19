import { NextResponse } from 'next/server';
import { runScan } from '@/src/services/scan-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await runScan();
  return NextResponse.json(result);
}

export async function GET() {
  const result = await runScan();
  return NextResponse.json(result);
}
