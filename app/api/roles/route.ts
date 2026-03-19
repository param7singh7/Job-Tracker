import { NextResponse } from 'next/server';
import { SEARCH_KEYWORD_GROUPS, TITLE_POSITIVE_KEYWORDS } from '@/src/config/keywords';
import { getCvTargetRoles } from '@/src/services/cv-fit-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    scannedSearchRoles: [...SEARCH_KEYWORD_GROUPS],
    titleMatchRoles: [...TITLE_POSITIVE_KEYWORDS],
    cvTargetRoles: getCvTargetRoles()
  });
}
