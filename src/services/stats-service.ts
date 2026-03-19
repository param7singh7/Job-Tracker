import { MatchLevel, ScanStatus } from '@prisma/client';
import { isToday, subDays } from 'date-fns';
import { DEFAULT_SEARCH_CONFIG } from '@/src/config/default-search-config';
import { prisma } from '@/src/lib/prisma';
import { logger } from '@/src/lib/logger';
import { getDemoDashboardStats } from '@/src/services/demo-fallback';
import { CvFitLabel, getCvFitForJob } from '@/src/services/cv-fit-service';
import { getLocationStats, getSourceStats } from '@/src/services/job-service';

export async function getDashboardStats(lastVisitAt?: Date) {
  try {
    const now = new Date();
    const defaultLastVisit = subDays(now, 1);
    const since = lastVisitAt ?? defaultLastVisit;

    const [
      jobs,
      unreviewed,
      applyNow,
      strongMatches,
      saved,
      applied,
      dismissedToday,
      sourceScanned,
      failingSources,
      sourceBreakdown,
      locationBreakdown,
      matchBreakdown,
      companyFrequency,
      cvFitRows
    ] = await Promise.all([
      prisma.job.count({ where: { classification: { not: 'EXCLUDED' } } }),
      prisma.userJobState.count({
        where: {
          reviewedAt: null,
          job: { classification: { not: 'EXCLUDED' } }
        }
      }),
      prisma.job.count({
        where: { matchLevel: MatchLevel.APPLY_NOW, classification: { not: 'EXCLUDED' } }
      }),
      prisma.job.count({
        where: {
          matchLevel: MatchLevel.STRONG_MATCH,
          classification: { not: 'EXCLUDED' }
        }
      }),
      prisma.userJobState.count({
        where: {
          isSaved: true,
          job: { classification: { not: 'EXCLUDED' } }
        }
      }),
      prisma.userJobState.count({
        where: {
          isApplied: true,
          job: { classification: { not: 'EXCLUDED' } }
        }
      }),
      prisma.userJobState.count({
        where: {
          isDismissed: true,
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          job: { classification: { not: 'EXCLUDED' } }
        }
      }),
      prisma.source.count({
        where: {
          health: { not: 'DOWN' },
          name: {
            in: DEFAULT_SEARCH_CONFIG.includedSources
          }
        }
      }),
      prisma.source.findMany({
        where: {
          health: 'DOWN',
          name: {
            in: DEFAULT_SEARCH_CONFIG.includedSources
          }
        },
        select: { name: true, lastError: true }
      }),
      getSourceStats(),
      getLocationStats(),
      prisma.job.groupBy({
        by: ['matchLevel'],
        _count: { matchLevel: true },
        where: { classification: { not: 'EXCLUDED' } }
      }),
      prisma.job.groupBy({
        by: ['companyNameCached'],
        _count: { companyNameCached: true },
        _max: { discoveredAt: true },
        where: { classification: { not: 'EXCLUDED' } }
      }),
      prisma.job.findMany({
        where: { classification: { not: 'EXCLUDED' } },
        select: {
          title: true,
          descriptionClean: true,
          descriptionRaw: true,
          extractedSkillsJson: true,
          seniorityLevel: true
        }
      })
    ]);

    const allJobs = await prisma.job.findMany({
      where: { classification: { not: 'EXCLUDED' } },
      select: { postedAt: true, discoveredAt: true }
    });

    const newToday = allJobs.filter((job) => isToday(job.postedAt ?? job.discoveredAt)).length;
    const newSinceLastVisit = allJobs.filter((job) => job.discoveredAt >= since).length;
    const emptyBucketCounts: Record<CvFitLabel, number> = {
      CV_MATCH: 0,
      GOOD_MATCH: 0,
      LESS_MATCH: 0,
      LOW_MATCH: 0,
      EXCLUDE: 0
    };
    const jobsByMatchBucket = cvFitRows.reduce((acc, row) => {
      const fit = getCvFitForJob({
        title: row.title,
        description: row.descriptionClean ?? row.descriptionRaw,
        extractedSkills: (row.extractedSkillsJson as string[] | null) ?? [],
        seniorityLevel: row.seniorityLevel
      });
      acc[fit.label] = (acc[fit.label] ?? 0) + 1;
      return acc;
    }, emptyBucketCounts);

    return {
      generatedAt: now,
      newToday,
      newSinceLastVisit,
      totalActiveRelevantJobs: jobs,
      applyNowCount: applyNow,
      strongMatchesCount: strongMatches,
      unreviewedCount: unreviewed,
      savedJobs: saved,
      appliedJobs: applied,
      dismissedToday,
      sourcesScannedSuccessfully: sourceScanned,
      jobsBySource: sourceBreakdown,
      jobsByLocation: locationBreakdown,
      jobsByMatchLevel: matchBreakdown.map((row) => ({
        matchLevel: row.matchLevel,
        count: row._count.matchLevel
      })),
      jobsByMatchBucket: Object.entries(jobsByMatchBucket).map(([matchBucket, count]) => ({
        matchBucket,
        count
      })),
      companiesHiringFrequently: companyFrequency
        .filter((row) => row._count.companyNameCached >= 2)
        .sort((a, b) => b._count.companyNameCached - a._count.companyNameCached)
        .slice(0, 12)
        .map((row) => ({
          company: row.companyNameCached,
          rolesOpen: row._count.companyNameCached,
          lastSeenAt: row._max.discoveredAt
        })),
      recentlyFailingSources: failingSources,
      dailyDigest: {
        status: failingSources.length ? ScanStatus.PARTIAL_FAILURE : ScanStatus.SUCCESS,
        highlights: [
          `${newToday} new jobs today`,
          `${applyNow} apply-now opportunities`,
          `${strongMatches} strong matches ready for review`
        ]
      }
    };
  } catch (error) {
    logger.warn('getDashboardStats fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return getDemoDashboardStats(lastVisitAt);
  }
}
