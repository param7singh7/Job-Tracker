import { SourceName } from '@prisma/client';
import { JobProviderAdapter } from '@/src/adapters/base';
import { disabledProviderResult, emptyProviderResult } from '@/src/adapters/common';
import { fetchBingRssJobsWithKeywordBatches, fetchRssJobs, getMockJobs } from '@/src/adapters/utils';
import { env, providerMode } from '@/src/lib/env';
import { ProviderFetchContext, ProviderFetchResult } from '@/src/types/job';

function buildIndeedFeedUrl(keywords: string[]): string {
  const q = encodeURIComponent(keywords.join(' OR '));
  return `https://ie.indeed.com/rss?q=${q}&l=Ireland`;
}

export class IndeedAdapter implements JobProviderAdapter {
  source = SourceName.INDEED;

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
        warnings: ['Indeed is running in mock mode'],
        health: {
          provider: this.source,
          status: 'degraded',
          message: 'Mock mode enabled'
        }
      };
    }

    const feedUrl = env.indeedFeedUrl || buildIndeedFeedUrl(context.keywords);
    const live = await fetchRssJobs(feedUrl, this.source, context.timeoutMs, 'Ireland');

    if (live.error) {
      const fallbackLive = await fetchBingRssJobsWithKeywordBatches({
        source: this.source,
        domains: ['ie.indeed.com/jobs', 'indeed.com/viewjob'],
        keywords: context.keywords,
        timeoutMs: context.timeoutMs,
        location: 'Ireland',
        maxBatches: Math.max(6, context.maxPages * 4),
        batchSize: 2
      });

      if (!fallbackLive.errors.length && fallbackLive.jobs.length) {
        return {
          ...emptyProviderResult(this.source, Date.now() - started),
          jobs: fallbackLive.jobs,
          warnings: ['Primary Indeed RSS failed, using Bing RSS fallback'],
          health: {
            provider: this.source,
            status: 'degraded',
            message: live.error
          }
        };
      }

      const fallbackJobs = env.enableMockMode ? getMockJobs(this.source, context.keywords) : [];
      return {
        ...emptyProviderResult(this.source, Date.now() - started),
        jobs: fallbackJobs,
        errors: fallbackLive.errors.length ? fallbackLive.errors : [live.error],
        warnings: fallbackJobs.length ? ['Fallback to mock data after live failure'] : [],
        health: {
          provider: this.source,
          status: fallbackJobs.length ? 'degraded' : 'down',
          message: fallbackLive.errors[0] ?? live.error
        }
      };
    }

    if (!live.jobs.length) {
      const fallbackJobs = env.enableMockMode ? getMockJobs(this.source, context.keywords) : [];
      return {
        ...emptyProviderResult(this.source, Date.now() - started),
        jobs: fallbackJobs,
        errors: ['No Indeed jobs returned from live source'],
        warnings: fallbackJobs.length ? ['Fallback to mock data after empty live result'] : [],
        health: {
          provider: this.source,
          status: fallbackJobs.length ? 'degraded' : 'down',
          message: 'No Indeed jobs returned from live source'
        }
      };
    }

    return {
      ...emptyProviderResult(this.source, Date.now() - started),
      jobs: live.jobs,
      health: {
        provider: this.source,
        status: 'healthy'
      }
    };
  }
}
