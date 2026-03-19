import { JobStatus, MatchLevel, Prisma, SourceName, WorkMode } from '@prisma/client';
import { subDays, startOfDay } from 'date-fns';
import { prisma } from '@/src/lib/prisma';
import { logger } from '@/src/lib/logger';
import { isAllowedWorkMode } from '@/src/lib/work-mode-filter';
import { dedupeJobsForDisplayWithOptions } from '@/src/services/display-dedupe';
import { CvFitLabel, getCvFitForJob } from '@/src/services/cv-fit-service';
import {
  getDemoJobById,
  getDemoLocationStats,
  getDemoSourceStats,
  queryDemoJobs,
  updateDemoJobState
} from '@/src/services/demo-fallback';

export interface JobsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  source?: SourceName;
  location?: string;
  workMode?: WorkMode;
  dateRange?:
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
    | 'all';
  matchLevel?: MatchLevel;
  minScore?: number;
  status?: JobStatus;
  unreviewedOnly?: boolean;
  includeStretch?: boolean;
  includeContract?: boolean;
  includeRemoteIrelandOnly?: boolean;
  collapseMultiLocationDuplicates?: boolean;
  matchBucket?: CvFitLabel[];
}

function rangeStart(range?: JobsQuery['dateRange']): Date | undefined {
  const now = new Date();
  if (!range || range === 'all') {
    return undefined;
  }

  if (range === 'since2026') {
    return new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
  }

  if (range === 'sinceMar2026') {
    return new Date(Date.UTC(2026, 2, 1, 0, 0, 0));
  }

  if (range === 'sinceFeb9') {
    return new Date(Date.UTC(2026, 1, 9, 0, 0, 0));
  }

  if (range === 'sinceFeb2026') {
    return new Date(Date.UTC(2026, 1, 1, 0, 0, 0));
  }

  if (range === 'today') {
    return startOfDay(now);
  }

  if (range === 'yesterday') {
    return startOfDay(subDays(now, 1));
  }

  const map: Record<'last1' | 'last3' | 'last7' | 'last14' | 'last30', number> = {
    last1: 1,
    last3: 3,
    last7: 7,
    last14: 14,
    last30: 30
  };

  if (range in map) {
    return subDays(now, map[range as keyof typeof map]);
  }

  return undefined;
}

export async function queryJobs(filters: JobsQuery) {
  try {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 25));

    const postedStart = rangeStart(filters.dateRange);
    const remoteIrelandCondition: Prisma.JobWhereInput = {
      workMode: WorkMode.REMOTE,
      AND: [
        {
          OR: [{ country: 'Ireland' }, { locationText: { contains: 'ireland', mode: 'insensitive' } }]
        },
        {
          NOT: [
            { locationText: { contains: 'european union', mode: 'insensitive' } },
            { locationText: { contains: 'europe', mode: 'insensitive' } },
            { locationText: { contains: 'emea', mode: 'insensitive' } }
          ]
        }
      ]
    };

    const where: Prisma.JobWhereInput = {
      classification: { not: 'EXCLUDED' },
      finalScore: filters.minScore ? { gte: filters.minScore } : undefined,
      matchLevel: filters.matchLevel,
      workMode: undefined,
      OR: filters.keyword
        ? [
            { title: { contains: filters.keyword, mode: 'insensitive' } },
            { companyNameCached: { contains: filters.keyword, mode: 'insensitive' } },
            { descriptionClean: { contains: filters.keyword, mode: 'insensitive' } }
          ]
        : undefined,
      city: filters.location ? { contains: filters.location, mode: 'insensitive' } : undefined,
      postedAt: postedStart ? { gte: postedStart } : undefined,
      jobSources: filters.source
        ? {
            some: {
              sourceName: filters.source
            }
          }
        : undefined,
      userStates: {
        some: {
          status: filters.status,
          reviewedAt: filters.unreviewedOnly ? null : undefined
        }
      }
    };

    const workModeConstraint: Prisma.JobWhereInput = filters.workMode
      ? filters.workMode === WorkMode.REMOTE
        ? remoteIrelandCondition
        : { workMode: filters.workMode }
      : {
          OR: [{ workMode: WorkMode.HYBRID }, { workMode: WorkMode.ONSITE }, remoteIrelandCondition]
        };
    const baseAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...baseAnd, workModeConstraint];

    if (filters.includeStretch === false) {
      where.matchLevel = { not: MatchLevel.STRETCH };
    }

    if (filters.includeContract === false) {
      where.employmentType = { not: 'CONTRACT' };
    }

    if (filters.includeRemoteIrelandOnly === true) {
      const currentAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...currentAnd, remoteIrelandCondition];
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        jobSources: {
          select: {
            sourceName: true,
            sourceUrl: true,
            applyUrl: true
          }
        },
        userStates: true,
        company: true
      },
      orderBy: [{ postedAt: 'desc' }, { finalScore: 'desc' }]
    });
    const filteredJobs = jobs.filter((job) => isAllowedWorkMode(job.workMode, job.locationText, job.country));
    const dedupedJobs = dedupeJobsForDisplayWithOptions(filteredJobs, {
      collapseMultiLocationDuplicates: filters.collapseMultiLocationDuplicates ?? false
    });
    const enrichedJobs = dedupedJobs.map((job) => {
      const cvFit = getCvFitForJob({
        title: job.title,
        description: job.descriptionClean ?? job.descriptionRaw,
        extractedSkills: (job.extractedSkillsJson as string[] | null) ?? [],
        seniorityLevel: job.seniorityLevel
      });

      return {
        ...job,
        cvFitScore: cvFit.score,
        matchBucket: cvFit.label,
        cvFitReasons: cvFit.reasons
      };
    });

    const selectedBuckets = filters.matchBucket?.length ? new Set(filters.matchBucket) : null;
    const bucketFilteredJobs = selectedBuckets
      ? enrichedJobs.filter((job) => selectedBuckets.has(job.matchBucket as CvFitLabel))
      : enrichedJobs;

    const bucketRank: Record<CvFitLabel, number> = {
      CV_MATCH: 0,
      GOOD_MATCH: 1,
      LESS_MATCH: 2,
      LOW_MATCH: 3,
      EXCLUDE: 4
    };

    const rankedJobs = [...bucketFilteredJobs].sort((a, b) => {
      const bucketDiff = bucketRank[a.matchBucket as CvFitLabel] - bucketRank[b.matchBucket as CvFitLabel];
      if (bucketDiff !== 0) {
        return bucketDiff;
      }

      const postedDiff = (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0);
      if (postedDiff !== 0) {
        return postedDiff;
      }

      return (b.finalScore ?? 0) - (a.finalScore ?? 0);
    });

    const total = rankedJobs.length;
    const pagedJobs = rankedJobs.slice((page - 1) * pageSize, page * pageSize);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      jobs: pagedJobs
    };
  } catch (error) {
    logger.warn('queryJobs fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return queryDemoJobs(filters);
  }
}

export async function updateJobState(jobId: string, input: Partial<{
  status: JobStatus;
  isSaved: boolean;
  isDismissed: boolean;
  isApplied: boolean;
  notes: string;
  followUpAt: string | null;
}>) {
  try {
    return await prisma.userJobState.upsert({
      where: { jobId },
      create: {
        jobId,
        status: input.status ?? JobStatus.NEW,
        isSaved: input.isSaved ?? false,
        isDismissed: input.isDismissed ?? false,
        isApplied: input.isApplied ?? false,
        notes: input.notes,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        reviewedAt: new Date()
      },
      update: {
        status: input.status,
        isSaved: input.isSaved,
        isDismissed: input.isDismissed,
        isApplied: input.isApplied,
        notes: input.notes,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
        lastSeenAt: new Date(),
        reviewedAt: new Date()
      }
    });
  } catch (error) {
    logger.warn('updateJobState fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return updateDemoJobState(jobId, input);
  }
}

export async function getJobById(id: string) {
  try {
    const row = await prisma.job.findUnique({
      where: { id },
      include: {
        company: true,
        jobSources: {
          select: {
            sourceName: true,
            sourceUrl: true,
            applyUrl: true,
            sourcePostedAt: true,
            sourcePostedText: true
          }
        },
        userStates: true,
        skills: true
      }
    });

    if (!row) {
      return null;
    }

    return row;
  } catch (error) {
    logger.warn('getJobById fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return getDemoJobById(id);
  }
}

export async function getSourceStats() {
  try {
    const rows = await prisma.jobSource.groupBy({
      by: ['sourceName'],
      _count: {
        sourceName: true
      },
      where: {
        job: { classification: { not: 'EXCLUDED' } }
      }
    });

    return rows.map((row) => ({
      source: row.sourceName,
      count: row._count.sourceName
    }));
  } catch (error) {
    logger.warn('getSourceStats fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return getDemoSourceStats();
  }
}

export async function getLocationStats() {
  try {
    const rows = await prisma.job.groupBy({
      by: ['city'],
      _count: {
        city: true
      },
      where: {
        classification: { not: 'EXCLUDED' }
      }
    });

    return rows.map((row) => ({
      location: row.city || 'Unknown',
      count: row._count.city
    }));
  } catch (error) {
    logger.warn('getLocationStats fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return getDemoLocationStats();
  }
}
