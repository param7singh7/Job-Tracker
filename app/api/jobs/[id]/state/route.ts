import { NextRequest, NextResponse } from 'next/server';
import { updateJobState } from '@/src/services/job-service';

export const dynamic = 'force-dynamic';

interface StateRouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: StateRouteParams) {
  const body = (await request.json()) as {
    status?:
      | 'NEW'
      | 'REVIEWING'
      | 'SAVED'
      | 'APPLIED'
      | 'INTERVIEW'
      | 'REJECTED'
      | 'CLOSED'
      | 'DISMISSED'
      | 'SNOOZED';
    isSaved?: boolean;
    isDismissed?: boolean;
    isApplied?: boolean;
    notes?: string;
    followUpAt?: string | null;
  };

  const updated = await updateJobState(params.id, body);
  return NextResponse.json(updated);
}
