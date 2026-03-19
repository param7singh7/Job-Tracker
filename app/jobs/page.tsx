import { MatchLevel, SourceName } from '@prisma/client';
import { JobsFilterForm } from '@/components/jobs-filter-form';
import { JobListItem, JobsList } from '@/components/jobs-list';
import { queryJobs } from '@/src/services/job-service';
import { getCvFitForJob } from '@/src/services/cv-fit-service';

export const dynamic = 'force-dynamic';

interface JobsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function toValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true' || value === 'on' || value === '1';
}

function toSource(value: string | undefined): SourceName | undefined {
  if (!value) {
    return undefined;
  }

  const candidate = value.split(',')[0]?.trim().toUpperCase();
  return Object.values(SourceName).includes(candidate as SourceName) ? (candidate as SourceName) : undefined;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const includeStretch = toBoolean(toValue(searchParams.includeStretch), true);
  const includeContract = toBoolean(toValue(searchParams.includeContract), true);
  const unreviewedOnly = toBoolean(toValue(searchParams.unreviewedOnly), false);
  const goodMatchOnly = toBoolean(toValue(searchParams.goodMatchOnly), false);
  const collapseMultiLocationDuplicates = toBoolean(toValue(searchParams.collapseMultiLocationDuplicates), false);
  const dateRange =
    (toValue(searchParams.dateRange) as
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
      | 'all') ?? 'last7';
  const minScoreParam = Number(toValue(searchParams.minScore) ?? 0);
  const minScore = Number.isFinite(minScoreParam) ? minScoreParam : 0;

  const parsedBuckets = toValue(searchParams.matchBucket)
    ?.split(',')
    .map((bucket) => bucket.trim().toUpperCase())
    .filter(Boolean) as Array<'CV_MATCH' | 'GOOD_MATCH' | 'LESS_MATCH' | 'LOW_MATCH' | 'EXCLUDE'> | undefined;

  const params = {
    keyword: toValue(searchParams.keyword),
    source: toSource(toValue(searchParams.source)),
    dateRange,
    matchLevel: toValue(searchParams.matchLevel) as MatchLevel | undefined,
    matchBucket: goodMatchOnly ? (['GOOD_MATCH'] as const) : parsedBuckets,
    minScore,
    includeStretch,
    includeContract,
    unreviewedOnly,
    collapseMultiLocationDuplicates,
    pageSize: 500
  };

  const result = await queryJobs(params);

  const jobs: JobListItem[] = result.jobs.map((job) => {
    const cachedBucket = (job as unknown as { matchBucket?: string }).matchBucket;
    const cachedScore = (job as unknown as { cvFitScore?: number }).cvFitScore;
    const cvFit = getCvFitForJob({
      title: job.title,
      description: job.descriptionClean ?? job.descriptionRaw,
      extractedSkills: (job.extractedSkillsJson as string[] | null) ?? [],
      seniorityLevel: job.seniorityLevel
    });

    return {
      id: job.id,
      postedAt: job.postedAt?.toISOString() ?? null,
      discoveredAt: job.discoveredAt.toISOString(),
      title: job.title,
      companyNameCached: job.companyNameCached,
      city: job.city,
      county: job.county,
      locationText: job.locationText,
      workMode: job.workMode,
      repostMentioned: (job.descriptionClean ?? job.descriptionRaw ?? '').toLowerCase().includes('reposted'),
      matchLevel: job.matchLevel,
      cvFitLabel: cachedBucket ?? cvFit.label,
      cvFitScore: cachedScore ?? cvFit.score,
      cvFitSummary: cvFit.reasons[0] ?? 'General analytics fit',
      userStatus: job.userStates[0]?.status ?? 'NEW',
      sources: [...new Set(job.jobSources.map((source) => source.sourceName))],
      openUrl: job.applyUrl ?? job.jobSources.find((source) => source.applyUrl)?.applyUrl ?? job.jobSources.find((source) => source.sourceUrl)?.sourceUrl ?? null
    };
  });

  const defaults = {
    ...Object.fromEntries(
      Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
    ),
    dateRange,
    minScore: String(minScore),
    includeStretch: includeStretch ? 'true' : 'false',
    includeContract: includeContract ? 'true' : 'false',
    goodMatchOnly: goodMatchOnly ? 'true' : 'false',
    unreviewedOnly: unreviewedOnly ? 'true' : 'false',
    collapseMultiLocationDuplicates: collapseMultiLocationDuplicates ? 'true' : 'false'
  } as Record<string, string | undefined>;

  return (
    <div className="space-y-4 fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">All Jobs</h1>
        <p className="text-sm text-zinc-600">
          LinkedIn primary with secondary feeds. Focused on hybrid/onsite roles and remote roles explicitly open to Ireland.
        </p>
      </div>

      <JobsFilterForm defaults={defaults} />
      <JobsList jobs={jobs} />
    </div>
  );
}
