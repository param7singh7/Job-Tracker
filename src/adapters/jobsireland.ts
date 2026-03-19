import * as cheerio from 'cheerio';
import { SourceName } from '@prisma/client';
import { JobProviderAdapter } from '@/src/adapters/base';
import { disabledProviderResult, emptyProviderResult } from '@/src/adapters/common';
import { fetchBingRssJobsWithKeywordBatches, getMockJobs } from '@/src/adapters/utils';
import { parsePostedAt } from '@/src/lib/dates';
import { env, providerMode } from '@/src/lib/env';
import { fetchWithTimeout } from '@/src/lib/http';
import { ProviderFetchContext, ProviderFetchResult, RawProviderJob } from '@/src/types/job';

const DEFAULT_JOBSIRELAND_URL = 'https://www.jobsireland.ie/en-US/browse-jobs?keywords=data%20analyst';

function parseJobsIrelandHtml(html: string): RawProviderJob[] {
  const $ = cheerio.load(html);
  const rows: RawProviderJob[] = [];

  $('.job-title-box a, a[href*="job-Details?id="]').each((idx, element) => {
    const anchor = $(element);
    const title = anchor.text().trim();
    const href = anchor.attr('href')?.trim();

    if (!title || !href) {
      return;
    }

    const rowContainer = anchor.closest('.vacancy-list-item, .job-list-item, li, .row');
    const locationText = rowContainer.find('.job-location, .location, [class*="location"]').first().text().trim();
    const postedText = rowContainer.find('.job-posted, .posted, [class*="posted"]').first().text().trim();
    const company = rowContainer.find('.job-company, .company, [class*="company"]').first().text().trim() || 'Unknown';

    rows.push({
      provider: SourceName.JOBSIRELAND,
      providerJobId: `jobsireland-${idx}-${title}`,
      title,
      company,
      sourceUrl: href.startsWith('http') ? href : `https://www.jobsireland.ie${href}`,
      applyUrl: href.startsWith('http') ? href : `https://www.jobsireland.ie${href}`,
      locationText: locationText || 'Ireland',
      postedText,
      postedAt: parsePostedAt(postedText),
      description: rowContainer.text().replace(/\s+/g, ' ').trim(),
      rawPayload: {
        title,
        href,
        locationText,
        postedText,
        company
      }
    });
  });

  return rows;
}

export class JobsIrelandAdapter implements JobProviderAdapter {
  source = SourceName.JOBSIRELAND;

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
        warnings: ['JobsIreland is running in mock mode'],
        health: {
          provider: this.source,
          status: 'degraded',
          message: 'Mock mode enabled'
        }
      };
    }

    const url = env.jobsIrelandFeedUrl || DEFAULT_JOBSIRELAND_URL;

    try {
      const response = await fetchWithTimeout(url, context.timeoutMs);
      if (!response.ok) {
        throw new Error(`JobsIreland request failed (${response.status})`);
      }

      const html = await response.text();
      const jobs = parseJobsIrelandHtml(html);

      if (jobs.length) {
        return {
          ...emptyProviderResult(this.source, Date.now() - started),
          jobs,
          health: {
            provider: this.source,
            status: 'healthy'
          }
        };
      }

      const rssFallback = await fetchBingRssJobsWithKeywordBatches({
        source: this.source,
        domains: ['jobsireland.ie/en-US/job-Details', 'jobsireland.ie'],
        keywords: context.keywords,
        timeoutMs: context.timeoutMs,
        location: 'Ireland',
        maxBatches: Math.max(6, context.maxPages * 4),
        batchSize: 2
      });

      if (!rssFallback.errors.length && rssFallback.jobs.length) {
        return {
          ...emptyProviderResult(this.source, Date.now() - started),
          jobs: rssFallback.jobs,
          warnings: ['Primary parser returned zero jobs, using Bing RSS fallback'],
          health: {
            provider: this.source,
            status: 'degraded',
            message: 'Using Bing RSS fallback'
          }
        };
      }

      throw new Error(
        rssFallback.errors[0]
          ? `JobsIreland parser returned zero jobs; RSS fallback failed: ${rssFallback.errors[0]}`
          : 'JobsIreland parser returned zero jobs'
      );
    } catch (error) {
      const fallbackJobs = env.enableMockMode ? getMockJobs(this.source, context.keywords) : [];
      const message = error instanceof Error ? error.message : 'Unknown JobsIreland fetch error';

      return {
        ...emptyProviderResult(this.source, Date.now() - started),
        jobs: fallbackJobs,
        errors: [message],
        warnings: fallbackJobs.length ? ['Fallback to mock data after live failure'] : [],
        health: {
          provider: this.source,
          status: fallbackJobs.length ? 'degraded' : 'down',
          message
        }
      };
    }
  }
}
