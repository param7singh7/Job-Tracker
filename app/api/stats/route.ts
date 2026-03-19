import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/src/services/stats-service';

export const dynamic = 'force-dynamic';

const COOKIE_KEY = 'radar_last_visit_at';

export async function GET() {
  const cookieStore = cookies();
  const lastVisitRaw = cookieStore.get(COOKIE_KEY)?.value;
  const parsed = lastVisitRaw ? new Date(lastVisitRaw) : undefined;
  const lastVisitAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;

  const stats = await getDashboardStats(lastVisitAt);

  const response = NextResponse.json(stats);
  response.cookies.set(COOKIE_KEY, new Date().toISOString(), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: 'lax'
  });

  return response;
}
