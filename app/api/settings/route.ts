import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SEARCH_CONFIG } from '@/src/config/default-search-config';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await prisma.searchConfig.findUnique({ where: { name: 'default' } });

    if (!config) {
      return NextResponse.json({
        name: 'default',
        ...DEFAULT_SEARCH_CONFIG
      });
    }

    return NextResponse.json({
      ...config,
      includedSources: [...DEFAULT_SEARCH_CONFIG.includedSources]
    });
  } catch {
    return NextResponse.json({
      name: 'default',
      ...DEFAULT_SEARCH_CONFIG,
      mode: 'demo-fallback'
    });
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as {
    includedSources: string[];
    keywordGroups: string[];
    excludedKeywordGroups: string[];
    locationFilters: string[];
    minimumScore: number;
    applyNowThreshold: number;
    includeStretchRoles: boolean;
    includeContractJobs: boolean;
    includeGraduateRoles: boolean;
    includeRemoteIreland: boolean;
    includeSuspiciousMatches: boolean;
    refreshFrequencyMinutes: number;
  };
  const payload = {
    ...body,
    includedSources: [...DEFAULT_SEARCH_CONFIG.includedSources],
    keywordGroups: [...DEFAULT_SEARCH_CONFIG.keywordGroups]
  };

  try {
    const upserted = await prisma.searchConfig.upsert({
      where: { name: 'default' },
      create: {
        name: 'default',
        ...payload
      },
      update: payload
    });

    return NextResponse.json(upserted);
  } catch {
    return NextResponse.json({
      name: 'default',
      ...payload,
      mode: 'demo-fallback',
      persisted: false
    });
  }
}
