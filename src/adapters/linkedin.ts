import { SourceName } from '@prisma/client';
import { JobProviderAdapter } from '@/src/adapters/base';
import { disabledProviderResult, emptyProviderResult } from '@/src/adapters/common';
import {
  fetchBingRssJobsWithKeywordBatches,
  fetchLinkedInGuestJobs,
  fetchRssJobs,
  getMockJobs
} from '@/src/adapters/utils';
import { env, providerMode } from '@/src/lib/env';
import { ProviderFetchContext, ProviderFetchResult, RawProviderJob } from '@/src/types/job';

export class LinkedInAdapter implements JobProviderAdapter {
  source = SourceName.LINKEDIN;

  private mergeBySourceUrl(jobs: RawProviderJob[]): RawProviderJob[] {
    const seen = new Set<string>();
    const merged: RawProviderJob[] = [];

    for (const job of jobs) {
      const key = (job.sourceUrl ?? `${job.title}|${job.company}|${job.locationText ?? ''}`).toLowerCase().trim();
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(job);
    }

    return merged;
  }

  async fetch(context: ProviderFetchContext): Promise<ProviderFetchResult> {
    const started = Date.now();
    const mode = providerMode(this.source);

    if (mode === 'off') {
      return disabledProviderResult(this.source, Date.now() - started);
    }

    if (mode === 'mock') {
      return {
        ...emptyProviderResult(this.source, Date.now() - started),
        jobs: getMockJobs(this.source, context.keywords),
        warnings: ['LinkedIn is running in mock mode'],
        health: {
          provider: this.source,
          status: 'degraded',
          message: 'Mock mode enabled'
        }
      };
    }

    let liveJobs: RawProviderJob[] = [];
    let liveErrors: string[] = [];

    if (env.linkedinFeedUrl) {
      const live = await fetchRssJobs(env.linkedinFeedUrl, this.source, context.timeoutMs, 'Ireland');
      liveJobs = live.jobs;
      liveErrors = live.error ? [live.error] : [];
    } else {
      const guestFetch = fetchLinkedInGuestJobs({
        strategy: env.linkedinScanStrategy,
        keywords: context.keywords,
        timeoutMs: context.timeoutMs,
        maxKeywords: env.linkedinMaxKeywords > 0 ? env.linkedinMaxKeywords : context.keywords.length,
        focusPagesPerKeyword: Math.max(6, Math.min(10, context.maxPages + 2)),
        priorityPagesPerKeyword: Math.max(3, Math.min(8, context.maxPages)),
        secondaryPagesPerKeyword: Math.max(1, Math.min(3, Math.floor(context.maxPages / 2))),
        maxPagesPerKeyword: env.linkedinMaxPagesPerKeyword,
        stopAfterEmptyPages: env.linkedinStopAfterEmptyPages,
        maxTotalRequests:
          env.linkedinMaxTotalRequests > 0
            ? env.linkedinMaxTotalRequests
            : Math.max(180, context.maxPages * 35),
        requestDelayMs: env.linkedinRequestDelayMs,
        keywordDelayMs: env.linkedinKeywordDelayMs
      });

      const bingFetch = env.linkedinUseBingSupplement
        ? fetchBingRssJobsWithKeywordBatches({
            source: this.source,
            domains: ['linkedin.com/jobs', 'ie.linkedin.com/jobs'],
            keywords: context.keywords,
            timeoutMs: context.timeoutMs,
            location: 'Ireland',
            maxBatches: Math.max(10, context.maxPages * 6),
            batchSize: 1
          })
        : Promise.resolve({ jobs: [] as RawProviderJob[], errors: [] as string[] });

      const [guestLive, bingLive] = await Promise.all([guestFetch, bingFetch]);

      liveJobs = this.mergeBySourceUrl([...guestLive.jobs, ...bingLive.jobs]);
      liveErrors = [...guestLive.errors, ...bingLive.errors];
    }

    if (!liveJobs.length) {
      const fallbackJobs = env.enableMockMode ? getMockJobs(this.source, context.keywords) : [];
      return {
        ...emptyProviderResult(this.source, Date.now() - started),
        jobs: fallbackJobs,
        errors: liveErrors.length ? liveErrors : ['No LinkedIn jobs returned from live source'],
        warnings: fallbackJobs.length ? ['Fallback to mock data after empty/failed live result'] : [],
        health: {
          provider: this.source,
          status: fallbackJobs.length ? 'degraded' : 'down',
          message: liveErrors[0] ?? 'No LinkedIn jobs returned from live source'
        }
      };
    }

    return {
      ...emptyProviderResult(this.source, Date.now() - started),
      jobs: liveJobs,
      errors: liveErrors,
      warnings: liveErrors.length ? ['Partial LinkedIn feed failures during batched query'] : [],
      health: {
        provider: this.source,
        status: liveErrors.length ? 'degraded' : 'healthy',
        message: liveErrors[0]
      }
    };
  }
}
