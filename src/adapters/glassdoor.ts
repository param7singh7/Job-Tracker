import { SourceName } from '@prisma/client';
import { JobProviderAdapter } from '@/src/adapters/base';
import { disabledProviderResult, emptyProviderResult } from '@/src/adapters/common';
import { fetchBingRssJobsWithKeywordBatches, fetchRssJobs, getMockJobs } from '@/src/adapters/utils';
import { env, providerMode } from '@/src/lib/env';
import { ProviderFetchContext, ProviderFetchResult, RawProviderJob } from '@/src/types/job';

const GLASSDOOR_RECOVERY_KEYWORDS = [
  'data analyst ireland',
  'business intelligence analyst ireland',
  'reporting analyst ireland',
  'insights analyst ireland',
  'commercial analyst ireland',
  'risk analyst ireland',
  'product analyst ireland'
] as const;

function uniqueBySourceUrl(jobs: RawProviderJob[]): RawProviderJob[] {
  const seen = new Set<string>();
  const merged: RawProviderJob[] = [];

  for (const job of jobs) {
    const key = (job.sourceUrl ?? job.applyUrl ?? `${job.title}|${job.company}`).toLowerCase().trim();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(job);
  }

  return merged;
}

export class GlassdoorAdapter implements JobProviderAdapter {
  source = SourceName.GLASSDOOR;

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
        warnings: ['Glassdoor is running in mock mode'],
        health: {
          provider: this.source,
          status: 'degraded',
          message: 'Mock mode enabled'
        }
      };
    }

    let liveJobs: RawProviderJob[] = [];
    let liveErrors: string[] = [];

    if (env.glassdoorFeedUrl) {
      const live = await fetchRssJobs(env.glassdoorFeedUrl, this.source, context.timeoutMs, 'Ireland');
      liveJobs = live.jobs;
      liveErrors = live.error ? [live.error] : [];
    } else {
      const primary = await fetchBingRssJobsWithKeywordBatches({
        source: this.source,
        domains: ['glassdoor.ie/Job', 'ie.glassdoor.com/Job', 'glassdoor.com/Job'],
        keywords: context.keywords,
        timeoutMs: context.timeoutMs,
        location: 'Ireland',
        maxBatches: Math.max(12, context.maxPages * 8),
        batchSize: 1
      });

      liveJobs = primary.jobs;
      liveErrors = primary.errors;

      if (!liveJobs.length) {
        const recovery = await fetchBingRssJobsWithKeywordBatches({
          source: this.source,
          domains: ['glassdoor.ie/Job', 'ie.glassdoor.com/Job', 'glassdoor.com/Job'],
          keywords: [...GLASSDOOR_RECOVERY_KEYWORDS],
          timeoutMs: context.timeoutMs,
          location: 'Ireland',
          maxBatches: Math.max(10, context.maxPages * 6),
          batchSize: 1
        });

        liveJobs = uniqueBySourceUrl([...primary.jobs, ...recovery.jobs]);
        liveErrors = [...primary.errors, ...recovery.errors];
      }
    }

    if (!liveJobs.length) {
      const fallbackJobs = env.enableMockMode ? getMockJobs(this.source, context.keywords) : [];
      return {
        ...emptyProviderResult(this.source, Date.now() - started),
        jobs: fallbackJobs,
        errors: liveErrors.length ? liveErrors : ['No Glassdoor jobs returned from live source'],
        warnings: fallbackJobs.length ? ['Fallback to mock data after empty/failed live result'] : [],
        health: {
          provider: this.source,
          status: fallbackJobs.length ? 'degraded' : 'down',
          message: liveErrors[0] ?? 'No Glassdoor jobs returned from live source'
        }
      };
    }

    return {
      ...emptyProviderResult(this.source, Date.now() - started),
      jobs: liveJobs,
      errors: liveErrors,
      warnings: liveErrors.length ? ['Partial Glassdoor feed failures during batched query'] : [],
      health: {
        provider: this.source,
        status: liveErrors.length ? 'degraded' : 'healthy',
        message: liveErrors[0]
      }
    };
  }
}
