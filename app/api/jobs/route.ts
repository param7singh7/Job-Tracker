import { MatchLevel, SourceName, WorkMode } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { queryJobs } from '@/src/services/job-service';
import { CvFitLabel, getCvFitForJob, getCvTargetRoles } from '@/src/services/cv-fit-service';

export const dynamic = 'force-dynamic';

function boolParam(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  return value === 'true' || value === '1' || value === 'on';
}

function sourceParam(value: string | null): SourceName | undefined {
  if (!value) {
    return undefined;
  }

  const candidate = value.split(',')[0]?.trim().toUpperCase();
  return Object.values(SourceName).includes(candidate as SourceName) ? (candidate as SourceName) : undefined;
}

function workModeParam(value: string | null): WorkMode | undefined {
  if (!value) {
    return undefined;
  }

  const candidate = value.trim().toUpperCase();
  return Object.values(WorkMode).includes(candidate as WorkMode) ? (candidate as WorkMode) : undefined;
}

function matchBucketParam(value: string | null): CvFitLabel[] | undefined {
  if (!value) {
    return undefined;
  }

  const allowed: CvFitLabel[] = ['CV_MATCH', 'GOOD_MATCH', 'LESS_MATCH', 'LOW_MATCH', 'EXCLUDE'];
  const parsed = value
    .split(',')
    .map((bucket) => bucket.trim().toUpperCase())
    .filter((bucket): bucket is CvFitLabel => allowed.includes(bucket as CvFitLabel));

  return parsed.length ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const collapseParam =
    searchParams.get('collapseMultiLocationDuplicates') ?? searchParams.get('collapse');

  const result = await queryJobs({
    // Convenience override for UI toggle.
    // When true, force match bucket to GOOD_MATCH.
    matchBucket:
      boolParam(searchParams.get('goodMatchOnly')) === true
        ? ['GOOD_MATCH']
        : matchBucketParam(searchParams.get('matchBucket')),
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Number(searchParams.get('pageSize') ?? 25),
    keyword: searchParams.get('keyword') ?? undefined,
    source: sourceParam(searchParams.get('source')),
    location: searchParams.get('location') ?? undefined,
    workMode: workModeParam(searchParams.get('workMode')),
    dateRange:
      (searchParams.get('dateRange') as
        | 'today'
        | 'last1'
        | 'yesterday'
        | 'last3'
        | 'last7'
        | 'last14'
        | 'last30'
        | 'sinceMar2026'
        | 'sinceFeb9'
        | 'since2026'
        | 'sinceFeb2026'
        | 'all'
        | null) ?? undefined,
    matchLevel: (searchParams.get('matchLevel') as MatchLevel | null) ?? undefined,
    minScore: searchParams.get('minScore') ? Number(searchParams.get('minScore')) : undefined,
    includeStretch: boolParam(searchParams.get('includeStretch')),
    includeContract: boolParam(searchParams.get('includeContract')),
    includeRemoteIrelandOnly: boolParam(searchParams.get('includeRemoteIrelandOnly')),
    unreviewedOnly: boolParam(searchParams.get('unreviewedOnly')),
    collapseMultiLocationDuplicates: boolParam(collapseParam)
  });

  const jobs = result.jobs.map((job) => {
    const cachedBucket = (job as unknown as { matchBucket?: CvFitLabel }).matchBucket;
    const cachedScore = (job as unknown as { cvFitScore?: number }).cvFitScore;
    const cachedReasons = (job as unknown as { cvFitReasons?: string[] }).cvFitReasons;
    const cvFit = getCvFitForJob({
      title: job.title,
      description: job.descriptionClean ?? job.descriptionRaw,
      extractedSkills: (job.extractedSkillsJson as string[] | null) ?? [],
      seniorityLevel: job.seniorityLevel
    });

    return {
      ...job,
      cvFitLabel: cachedBucket ?? cvFit.label,
      matchBucket: cachedBucket ?? cvFit.label,
      cvFitScore: cachedScore ?? cvFit.score,
      cvFitReasons: cachedReasons ?? cvFit.reasons
    };
  });

  return NextResponse.json({
    ...result,
    jobs,
    cvTargetRoles: getCvTargetRoles()
  });
}
