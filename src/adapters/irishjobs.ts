import { SourceName } from '@prisma/client';
import { JobProviderAdapter } from '@/src/adapters/base';
import { disabledProviderResult, emptyProviderResult } from '@/src/adapters/common';
import { fetchBingRssJobsWithKeywordBatches, fetchRssJobs, getMockJobs } from '@/src/adapters/utils';
import { env, providerMode } from '@/src/lib/env';
import { ProviderFetchContext, ProviderFetchResult } from '@/src/types/job';

export class IrishJobsAdapter implements JobProviderAdapter {
  source = SourceName.IRISHJOBS;

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
        warnings: ['IrishJobs is running in mock mode'],
        health: {
          provider: this.source,
          status: 'degraded',
          message: 'Mock mode enabled'
        }
      };
    }

    const live = env.irishJobsFeedUrl
      ? await fetchRssJobs(env.irishJobsFeedUrl, this.source, context.timeoutMs, 'Ireland')
      : await fetchBingRssJobsWithKeywordBatches({
          source: this.source,
          domains: ['irishjobs.ie', 'www.irishjobs.ie'],
          keywords: context.keywords,
          timeoutMs: context.timeoutMs,
          location: 'Ireland',
          maxBatches: Math.max(6, context.maxPages * 4),
          batchSize: 2
        });

    const liveErrors = Array.isArray((live as { errors?: string[] }).errors)
      ? ((live as { errors?: string[] }).errors ?? [])
      : (live as { error?: string }).error
        ? [(live as { error?: string }).error as string]
        : [];
    const liveJobs = live.jobs;

    if (!liveJobs.length) {
      const fallbackJobs = env.enableMockMode ? getMockJobs(this.source, context.keywords) : [];
      return {
        ...emptyProviderResult(this.source, Date.now() - started),
        jobs: fallbackJobs,
        errors: liveErrors.length ? liveErrors : ['No IrishJobs jobs returned from live source'],
        warnings: fallbackJobs.length ? ['Fallback to mock data after empty/failed live result'] : [],
        health: {
          provider: this.source,
          status: fallbackJobs.length ? 'degraded' : 'down',
          message: liveErrors[0] ?? 'No IrishJobs jobs returned from live source'
        }
      };
    }

    return {
      ...emptyProviderResult(this.source, Date.now() - started),
      jobs: liveJobs,
      errors: liveErrors,
      warnings: liveErrors.length ? ['Partial IrishJobs feed failures during batched query'] : [],
      health: {
        provider: this.source,
        status: liveErrors.length ? 'degraded' : 'healthy',
        message: liveErrors[0]
      }
    };
  }
}
