import * as cheerio from 'cheerio';
import { SourceName } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { fetchWithTimeout } from '@/src/lib/http';
import { parsePostedAt } from '@/src/lib/dates';
import { env } from '@/src/lib/env';
import { hashableKey, includesAny, normalizeText } from '@/src/lib/text';
import { RawProviderJob } from '@/src/types/job';
import { MOCK_PROVIDER_JOBS } from '@/src/mock/jobs';

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

const BROAD_ANALYTICS_TERMS = [
  'data',
  'analytics',
  'insights',
  'reporting',
  'dashboard',
  'business intelligence',
  'power bi',
  'power platform',
  'dax',
  'tableau',
  'sql',
  'kpi',
  'operational dashboard',
  'decision support',
  'compliance reporting',
  'fraud analysis',
  'risk analysis',
  'healthcare',
  'medtech'
] as const;

const ROLE_INTENT_TERMS = [
  'analyst',
  'analytics consultant',
  'insights',
  'decision support',
  'bi',
  'reporting',
  'commercial',
  'marketing',
  'product',
  'operations',
  'risk',
  'fraud',
  'revenue',
  'supply chain',
  'functional consultant',
  'power platform consultant',
  'business analyst',
  'process analyst',
  'transformation analyst',
  'compliance analyst',
  'healthcare data analyst',
  'medtech analyst',
  'sql developer',
  'bi developer',
  'reporting developer'
] as const;

const DESCRIPTION_SIGNAL_TERMS = [
  'sql',
  't-sql',
  'excel',
  'power bi',
  'power platform',
  'power apps',
  'power automate',
  'dax',
  'tableau',
  'dashboard',
  'kpi',
  'stakeholder reporting',
  'ad hoc analysis',
  'data quality',
  'trend analysis',
  'requirements gathering',
  'process mapping',
  'power platform',
  'power apps',
  'power automate',
  'azure data factory',
  'azure synapse',
  'data pipeline',
  'compliance reporting',
  'quality systems',
  'due diligence',
  'regulated environment',
  'operational performance'
] as const;

const LINKEDIN_PRIORITY_TERMS = [
  'data analyst',
  'business data analyst',
  'reporting analyst',
  'insights analyst',
  'data and insights analyst',
  'reporting and insights analyst',
  'business intelligence analyst',
  'business intelligence reporting analyst',
  'mi analyst',
  'data reporting analyst',
  'sql analyst',
  'power bi analyst',
  'tableau analyst',
  'dashboard analyst',
  'bi developer',
  'power bi developer',
  'reporting developer',
  'sql developer',
  'data and business intelligence analyst',
  'data quality analyst',
  'decision support analyst',
  'performance analyst',
  'operations reporting analyst',
  'operations insights analyst',
  'business analyst',
  'junior business analyst',
  'systems analyst',
  'functional analyst',
  'process analyst',
  'business process analyst',
  'transformation analyst',
  'analytics consultant',
  'reporting consultant',
  'functional consultant',
  'power platform consultant',
  'power bi consultant',
  'power apps consultant',
  'power automate consultant',
  'compliance analyst',
  'quality reporting analyst',
  'healthcare data analyst',
  'medtech analyst',
  'risk reporting analyst',
  'fraud analytics analyst',
  'customer insights analyst',
  'product analyst',
  'marketing analyst',
  'commercial analyst',
  'revenue analyst',
  'risk analyst',
  'fraud analyst',
  'analytics engineer',
  'data warehouse developer',
  'junior data analyst',
  'graduate data analyst'
] as const;

const LINKEDIN_FOCUS_TERMS = [
  'data analyst',
  'business data analyst',
  'business intelligence analyst',
  'reporting analyst',
  'insights analyst',
  'power bi analyst',
  'sql analyst',
  'data and business intelligence analyst',
  'healthcare data analyst',
  'analytics consultant'
] as const;

function uniqueByStableKey(jobs: RawProviderJob[]): RawProviderJob[] {
  const seen = new Set<string>();
  const merged: RawProviderJob[] = [];

  for (const job of jobs) {
    const key = job.sourceUrl
      ? normalizeText(job.sourceUrl)
      : normalizeText(`${job.provider}|${job.title}|${job.company}|${job.locationText ?? ''}`);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(job);
  }

  return merged;
}

export function keywordFilter(jobs: RawProviderJob[], keywords: string[]): RawProviderJob[] {
  if (!keywords.length) {
    return jobs;
  }

  const normalizedKeywords = keywords.map((x) => normalizeText(x)).filter(Boolean);
  return jobs.filter((job) => {
    const searchBlob = normalizeText(`${job.title} ${job.description ?? ''}`);
    if (normalizedKeywords.some((keyword) => searchBlob.includes(keyword))) {
      return true;
    }

    const analyticsSignalCount = BROAD_ANALYTICS_TERMS.filter((term) => searchBlob.includes(term)).length;
    const roleSignalCount = ROLE_INTENT_TERMS.filter((term) => searchBlob.includes(term)).length;
    const descriptionSignalCount = DESCRIPTION_SIGNAL_TERMS.filter((term) => searchBlob.includes(term)).length;
    const supportSignalCount = includesAny(searchBlob, [
      'support',
      'service desk',
      'incident',
      'ticket',
      'helpdesk',
      'desktop support'
    ]).length;
    const analyticsBridgeCount = includesAny(searchBlob, [
      'sql',
      'power bi',
      'dashboard',
      'reporting',
      'kpi',
      'metrics',
      'insights',
      'business intelligence'
    ]).length;
    const dataPipelineCount = includesAny(searchBlob, [
      'data warehouse',
      'etl',
      'elt',
      'data pipeline',
      'reporting pipeline',
      'analytics pipeline'
    ]).length;

    if (supportSignalCount >= 2 && analyticsBridgeCount < 2) {
      return false;
    }

    if (analyticsSignalCount >= 1 && roleSignalCount >= 1) {
      return true;
    }

    if (descriptionSignalCount >= 2 || analyticsBridgeCount >= 2) {
      return true;
    }

    if (dataPipelineCount >= 1 && analyticsBridgeCount >= 1) {
      return true;
    }

    if (supportSignalCount >= 1 && analyticsBridgeCount >= 2) {
      return true;
    }

    return analyticsSignalCount + roleSignalCount + descriptionSignalCount + analyticsBridgeCount + dataPipelineCount >= 3;
  });
}

export function getMockJobs(source: SourceName, keywords: string[]): RawProviderJob[] {
  return keywordFilter(MOCK_PROVIDER_JOBS.filter((job) => job.provider === source), keywords);
}

export function backfillProviderJobs(
  source: SourceName,
  keywords: string[],
  liveJobs: RawProviderJob[],
  minimumTarget: number
): { jobs: RawProviderJob[]; backfilled: number } {
  if (liveJobs.length >= minimumTarget) {
    return {
      jobs: uniqueByStableKey(liveJobs),
      backfilled: 0
    };
  }

  const mockJobs = getMockJobs(source, keywords);
  const merged = uniqueByStableKey([...liveJobs, ...mockJobs]);

  return {
    jobs: merged,
    backfilled: Math.max(0, merged.length - liveJobs.length)
  };
}

export function buildBingRssSearchFeed(options: {
  domains: string[];
  keywords: string[];
  location?: string;
}): string {
  const location = options.location ?? 'Ireland';
  const domainQuery = options.domains.map((domain) => `site:${domain}`).join(' OR ');
  const narrowedKeywords = options.keywords.slice(0, 10);
  const keywordQuery = narrowedKeywords.length
    ? narrowedKeywords.map((keyword) => `"${keyword}"`).join(' OR ')
    : '"data analyst" OR "reporting analyst" OR "insights analyst"';
  const query = `${domainQuery} (${keywordQuery}) (${location}) (job OR jobs OR vacancy)`;

  return `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&setlang=en&cc=ie&mkt=en-IE`;
}

function extractLinkedInJobId(url: string): string | null {
  const fromPath = url.match(/\/jobs\/view\/(?:[^/?#]+-)?(\d+)/i)?.[1];
  if (fromPath) {
    return fromPath;
  }

  const fromQuery = url.match(/[?&](?:currentJobId|jobId)=(\d{6,})/i)?.[1];
  if (fromQuery) {
    return fromQuery;
  }

  const fromAnyLongNumber = url.match(/(\d{7,})/)?.[1];
  return fromAnyLongNumber ?? null;
}

function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('linkedin.com')) {
      const jobId = extractLinkedInJobId(url);
      if (jobId) {
        return `https://www.linkedin.com/jobs/view/${jobId}/`;
      }

      parsed.hostname = 'www.linkedin.com';
    }

    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function inferWorkModeText(blob: string): string | undefined {
  const normalized = normalizeText(blob);

  if (normalized.includes('hybrid')) {
    return 'Hybrid';
  }

  if (normalized.includes('on site') || normalized.includes('onsite')) {
    return 'On-site';
  }

  if (normalized.includes('remote')) {
    return 'Remote';
  }

  return undefined;
}

function buildLinkedInSearchUrl(keyword: string, start = 0): string {
  const params = new URLSearchParams({
    keywords: keyword,
    location: 'Ireland',
    geoId: '104738515',
    start: String(start),
    sortBy: 'DD'
  });

  // Junior/associate/mid-senior and all work types, then filter downstream for remote-Ireland rules.
  params.set('f_E', '2,3,4');
  params.set('f_WT', '1,2,3');

  if (env.minPostedAt) {
    const seconds = Math.max(24 * 60 * 60, Math.floor((Date.now() - env.minPostedAt.getTime()) / 1000));
    params.set('f_TPR', `r${seconds}`);
  }

  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
}

function parseLinkedInGuestHtml(html: string, keyword: string, start: number): RawProviderJob[] {
  const $ = cheerio.load(html);
  const jobs: RawProviderJob[] = [];

  $('.base-search-card').each((idx, element) => {
    const card = $(element);
    const anchor = card.find('a.base-card__full-link').first();
    const sourceUrlRaw = anchor.attr('href')?.trim();

    if (!sourceUrlRaw) {
      return;
    }

    const sourceUrl = canonicalizeUrl(sourceUrlRaw);

    const title = card.find('.base-search-card__title').first().text().replace(/\s+/g, ' ').trim();
    const company = card.find('.base-search-card__subtitle').first().text().replace(/\s+/g, ' ').trim();
    const locationText = card.find('.job-search-card__location').first().text().replace(/\s+/g, ' ').trim();
    const metadataText = card.find('.base-search-card__metadata').first().text().replace(/\s+/g, ' ').trim();
    const snippet = card
      .find('.job-search-card__snippet, .job-search-card__snippit')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const cardText = card.text().replace(/\s+/g, ' ').trim();
    const timeEl = card.find('time').first();
    const postedText = timeEl.text().replace(/\s+/g, ' ').trim();
    const postedDatetime = (timeEl.attr('datetime') ?? '').trim();

    if (!title) {
      return;
    }

    const id =
      extractLinkedInJobId(sourceUrl) ??
      hashableKey([sourceUrl]) ??
      `linkedin-${normalizeText(keyword)}-${start}-${idx}`;
    const workModeText = inferWorkModeText(`${title} ${locationText} ${metadataText} ${snippet} ${cardText}`);
    const locationWithMode =
      workModeText && locationText && !normalizeText(locationText).includes(normalizeText(workModeText))
        ? `${locationText} (${workModeText})`
        : locationText;
    const description = [metadataText, snippet, `${title} at ${company || 'Unknown'} ${locationWithMode || locationText}.`]
      .filter(Boolean)
      .join(' ');

    jobs.push({
      provider: SourceName.LINKEDIN,
      providerJobId: `linkedin-${id}`,
      title,
      company: company || 'Unknown',
      sourceUrl,
      applyUrl: sourceUrl,
      locationText: locationWithMode || locationText || 'Ireland',
      workModeText,
      postedText: postedText || postedDatetime,
      postedAt: parsePostedAt(postedDatetime || postedText),
      description,
      rawPayload: {
        keyword,
        start,
        postedDatetime,
        postedText,
        metadataText,
        snippet,
        cardText,
        workModeText
      }
    });
  });

  return jobs;
}

export async function fetchLinkedInGuestJobs(options: {
  strategy?: 'targeted' | 'exhaustive';
  keywords: string[];
  timeoutMs: number;
  maxKeywords?: number;
  focusPagesPerKeyword?: number;
  priorityPagesPerKeyword?: number;
  secondaryPagesPerKeyword?: number;
  maxPagesPerKeyword?: number;
  stopAfterEmptyPages?: number;
  maxTotalRequests?: number;
  requestDelayMs?: number;
  keywordDelayMs?: number;
}): Promise<{ jobs: RawProviderJob[]; errors: string[] }> {
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  type LinkedInRequest = {
    keyword: string;
    start: number;
    url: string;
    attempts: number;
  };

  const MAX_RETRIES = 2;
  const strategy = options.strategy ?? 'targeted';
  const requestDelayMs = Math.max(120, options.requestDelayMs ?? 430);
  const keywordDelayMs = Math.max(requestDelayMs, options.keywordDelayMs ?? 1200);

  const fetchRequest = async (
    request: LinkedInRequest
  ): Promise<{
    jobs: RawProviderJob[];
    error: string | null;
    retryRequest: LinkedInRequest | null;
  }> => {
    try {
      const response = await fetchWithTimeout(request.url, options.timeoutMs);
      if (!response.ok) {
        const retryableStatus = new Set([403, 429, 999]);
        if (retryableStatus.has(response.status)) {
          if (request.attempts < MAX_RETRIES) {
            return {
              jobs: [],
              error: null,
              retryRequest: {
                ...request,
                attempts: request.attempts + 1
              }
            };
          }

          return {
            jobs: [],
            error: `LinkedIn guest request failed (${response.status}) after retries for keyword "${request.keyword}"`,
            retryRequest: null
          };
        }

        return {
          jobs: [],
          error: `LinkedIn guest request failed (${response.status}) for keyword "${request.keyword}"`,
          retryRequest: null
        };
      }

      const html = await response.text();
      return {
        jobs: parseLinkedInGuestHtml(html, request.keyword, request.start),
        error: null,
        retryRequest: null
      };
    } catch (error) {
      return {
        jobs: [],
        error: `LinkedIn guest fetch failed for keyword "${request.keyword}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        retryRequest: null
      };
    }
  };

  const fetchRequestWithRetry = async (
    request: LinkedInRequest
  ): Promise<{
    jobs: RawProviderJob[];
    error: string | null;
  }> => {
    let current: LinkedInRequest | null = request;

    while (current) {
      const row = await fetchRequest(current);
      if (row.retryRequest) {
        const backoff = 850 * row.retryRequest.attempts + Math.floor(Math.random() * 250);
        await sleep(backoff);
        current = row.retryRequest;
        continue;
      }

      return {
        jobs: row.jobs,
        error: row.error
      };
    }

    return {
      jobs: [],
      error: null
    };
  };

  if (strategy === 'exhaustive') {
    const normalizedKeywords = [...new Set(options.keywords.map((x) => normalizeText(x)).filter(Boolean))];
    const selectedKeywords = (
      normalizedKeywords.length
        ? normalizedKeywords
        : ['data analyst']
    ).slice(0, options.maxKeywords && options.maxKeywords > 0 ? options.maxKeywords : normalizedKeywords.length || 1);
    const maxPagesPerKeyword = Math.max(1, Math.min(80, options.maxPagesPerKeyword ?? 20));
    const stopAfterEmptyPages = Math.max(1, Math.min(5, options.stopAfterEmptyPages ?? 2));
    const maxTotalRequests = Math.max(
      selectedKeywords.length,
      options.maxTotalRequests && options.maxTotalRequests > 0
        ? options.maxTotalRequests
        : selectedKeywords.length * maxPagesPerKeyword
    );

    const jobs: RawProviderJob[] = [];
    const errors: string[] = [];
    let requestsUsed = 0;

    outer: for (let keywordIndex = 0; keywordIndex < selectedKeywords.length; keywordIndex += 1) {
      const keyword = selectedKeywords[keywordIndex];
      let emptyPageStreak = 0;
      let failureStreak = 0;

      for (let page = 0; page < maxPagesPerKeyword; page += 1) {
        if (requestsUsed >= maxTotalRequests) {
          break outer;
        }

        const request: LinkedInRequest = {
          keyword,
          start: page * 25,
          url: buildLinkedInSearchUrl(keyword, page * 25),
          attempts: 0
        };
        requestsUsed += 1;

        const row = await fetchRequestWithRetry(request);
        jobs.push(...row.jobs);

        if (row.error) {
          errors.push(row.error);
          failureStreak += 1;
          emptyPageStreak += 1;
        } else {
          failureStreak = 0;

          if (row.jobs.length === 0) {
            emptyPageStreak += 1;
          } else if (row.jobs.length < 25) {
            emptyPageStreak += 1;
          } else {
            emptyPageStreak = 0;
          }
        }

        if (failureStreak >= stopAfterEmptyPages || emptyPageStreak >= stopAfterEmptyPages) {
          break;
        }

        if (page + 1 < maxPagesPerKeyword && requestsUsed < maxTotalRequests) {
          await sleep(requestDelayMs + Math.floor(Math.random() * 220));
        }
      }

      if (keywordIndex + 1 < selectedKeywords.length && requestsUsed < maxTotalRequests) {
        await sleep(keywordDelayMs + Math.floor(Math.random() * 300));
      }
    }

    return {
      jobs: uniqueByStableKey(jobs),
      errors: [...new Set(errors)]
    };
  }

  const normalized = [...new Set(options.keywords.map((x) => normalizeText(x)).filter(Boolean))];
  const broad = normalized.filter((keyword) =>
    [
      'analyst',
      'business intelligence',
      'insights',
      'reporting',
      'sql',
      'power bi',
      'power platform',
      'dax',
      'tableau',
      'data governance',
      'data quality',
      'decision support',
      'operations',
      'commercial',
      'marketing',
      'customer',
      'consultant',
      'business analyst',
      'process analyst',
      'healthcare',
      'medtech',
      'compliance',
      'risk',
      'fraud',
      'sql developer',
      'reporting developer'
    ].some((token) => keyword.includes(token))
  );

  const priorityKeywords = [...new Set([...LINKEDIN_PRIORITY_TERMS, ...broad].map((x) => normalizeText(x)))];
  const maxKeywords = Math.max(20, options.maxKeywords ?? 24);
  const maxPriorityKeywords = Math.min(maxKeywords, Math.max(12, Math.floor(maxKeywords * 0.55)));
  const maxSecondaryKeywords = Math.max(0, maxKeywords - maxPriorityKeywords);

  const prioritySelected = priorityKeywords.slice(0, maxPriorityKeywords);
  const prioritySet = new Set(prioritySelected);
  const longTail = normalized.filter((keyword) => !prioritySet.has(keyword));
  const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 30));
  const offset = longTail.length ? (rotationSeed * Math.max(1, maxSecondaryKeywords)) % longTail.length : 0;
  const rotatedLongTail = longTail.length ? [...longTail.slice(offset), ...longTail.slice(0, offset)] : [];
  const secondarySelected = rotatedLongTail.slice(0, maxSecondaryKeywords);

  const keywords = [...new Set([...prioritySelected, ...secondarySelected, 'data analyst'])].slice(0, maxKeywords);
  const focusSet = new Set(LINKEDIN_FOCUS_TERMS.map((x) => normalizeText(x)));
  const priorityPages = Math.max(2, Math.min(8, options.priorityPagesPerKeyword ?? 4));
  const secondaryPages = Math.max(1, Math.min(priorityPages, options.secondaryPagesPerKeyword ?? 2));
  const focusPages = Math.max(priorityPages, Math.min(10, options.focusPagesPerKeyword ?? priorityPages + 2));
  const maxTotalRequests = Math.max(60, options.maxTotalRequests ?? 220);

  const jobs: RawProviderJob[] = [];
  const errors: string[] = [];
  type PlannedRequest = LinkedInRequest & { priority: number };
  const plannedRequests: PlannedRequest[] = [];

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    const isFocus = focusSet.has(normalizedKeyword);
    const isPriority = prioritySet.has(normalizedKeyword);
    const pageCount = isFocus ? focusPages : isPriority ? priorityPages : secondaryPages;
    const tierWeight = isFocus ? 3 : isPriority ? 2 : 1;

    for (let page = 0; page < pageCount; page += 1) {
      plannedRequests.push({
        keyword,
        start: page * 25,
        url: buildLinkedInSearchUrl(keyword, page * 25),
        attempts: 0,
        priority: tierWeight * 100 - page
      });
    }
  }

  const requests: LinkedInRequest[] = plannedRequests
    .sort((a, b) => b.priority - a.priority || a.keyword.localeCompare(b.keyword) || a.start - b.start)
    .slice(0, maxTotalRequests)
    .map(({ priority: _priority, ...request }) => request);

  const concurrency = requests.length > 140 ? 1 : 2;
  for (let i = 0; i < requests.length; i += concurrency) {
    const chunk = requests.slice(i, i + concurrency);
    const rows = await Promise.all(chunk.map((request) => fetchRequestWithRetry(request)));

    for (const row of rows) {
      jobs.push(...row.jobs);
      if (row.error) {
        errors.push(row.error);
      }
    }

    if (i + concurrency < requests.length) {
      await sleep(requestDelayMs + Math.floor(Math.random() * 260));
    }
  }

  return {
    jobs: uniqueByStableKey(jobs),
    errors: [...new Set(errors)]
  };
}

export async function fetchBingRssJobsWithKeywordBatches(options: {
  source: SourceName;
  domains: string[];
  keywords: string[];
  timeoutMs: number;
  location?: string;
  maxBatches?: number;
  batchSize?: number;
}): Promise<{ jobs: RawProviderJob[]; errors: string[] }> {
  const normalizedKeywords = [...new Set(options.keywords.map((x) => normalizeText(x)).filter(Boolean))];
  const highIntentKeywords = normalizedKeywords.filter((keyword) => {
    const intentTokens = [
      'analyst',
      'analytics consultant',
      'business intelligence',
      'insights',
      'reporting',
      'decision support',
      'data quality',
      'kpi',
      'dashboard',
      'power bi',
      'tableau',
      'sql',
      'data governance',
      'fraud',
      'risk',
      'operations',
      'consultant',
      'business analyst',
      'healthcare',
      'medtech',
      'compliance',
      'reporting developer',
      'sql developer'
    ];

    return intentTokens.some((token) => keyword.includes(token));
  });

  const queryKeywords = highIntentKeywords.length ? highIntentKeywords : normalizedKeywords;
  const batchSize = Math.max(2, options.batchSize ?? 4);
  const maxBatches = Math.max(1, options.maxBatches ?? 6);

  const batches: string[][] = [];
  for (let i = 0; i < queryKeywords.length && batches.length < maxBatches; i += batchSize) {
    const chunk = queryKeywords.slice(i, i + batchSize);
    if (chunk.length) {
      batches.push(chunk);
    }
  }

  if (!batches.length) {
    batches.push(['data analyst', 'reporting analyst', 'insights analyst', 'business intelligence analyst']);
  }

  const responses = await Promise.all(
    batches.map(async (batch) => {
      const url = buildBingRssSearchFeed({
        domains: options.domains,
        keywords: batch,
        location: options.location
      });
      return fetchRssJobs(url, options.source, options.timeoutMs, options.location ?? 'Ireland');
    })
  );

  const merged = uniqueByStableKey(responses.flatMap((response) => response.jobs));

  const allowedHosts = [
    ...new Set(options.domains.map((domain) => domain.split('/')[0].replace(/^www\./, '').toLowerCase()))
  ];
  const filtered = merged.filter((job) => {
    if (!job.sourceUrl) {
      return false;
    }

    try {
      const host = new URL(job.sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
      return allowedHosts.some((allowed) => host.includes(allowed));
    } catch {
      return false;
    }
  });
  const keywordFiltered = keywordFilter(filtered, options.keywords);

  const errors = responses
    .filter((response) => response.error)
    .map((response) => response.error as string);

  return {
    jobs: keywordFiltered,
    errors
  };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseCompanyAndLocation(titleText: string): { title: string; company: string; locationText?: string } {
  const chunks = titleText.split(' - ').map((x) => x.trim()).filter(Boolean);
  const normalizedChunks = chunks.map((chunk) => normalizeText(chunk));

  if (chunks.length >= 3) {
    const trailingSource = normalizedChunks[chunks.length - 1];
    const middle = chunks[chunks.length - 2];
    const middleLooksLikeDate = /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/.test(middle);
    const knownSource = ['indeed', 'linkedin', 'glassdoor', 'irishjobs', 'jobsireland'].some((x) =>
      trailingSource.includes(x)
    );

    if (middleLooksLikeDate && knownSource) {
      return {
        title: chunks[0],
        company: chunks[chunks.length - 1],
        locationText: 'Ireland'
      };
    }

    return {
      title: chunks[0],
      company: chunks[1],
      locationText: chunks.slice(2).join(' - ')
    };
  }

  if (chunks.length === 2) {
    return {
      title: chunks[0],
      company: chunks[1]
    };
  }

  return {
    title: titleText,
    company: 'Unknown'
  };
}

export async function fetchRssJobs(
  feedUrl: string,
  source: SourceName,
  timeoutMs: number,
  queryLocationHint?: string
): Promise<{ jobs: RawProviderJob[]; error?: string }> {
  try {
    const response = await fetchWithTimeout(feedUrl, timeoutMs);
    if (!response.ok) {
      return {
        jobs: [],
        error: `RSS request failed (${response.status})`
      };
    }

    const xml = await response.text();
    const parsed = parser.parse(xml) as {
      rss?: { channel?: { item?: unknown[] | unknown } };
      feed?: { entry?: unknown[] | unknown };
    };

    const rssItems = toArray(parsed.rss?.channel?.item as Record<string, unknown> | undefined);
    const atomItems = toArray(parsed.feed?.entry as Record<string, unknown> | undefined);

    const rawItems = rssItems.length ? rssItems : atomItems;

    const jobs = rawItems.map((item) => {
      const row = item as Record<string, unknown>;
      const titleRaw = String(row.title ?? 'Untitled role');
      const summary = String(row.description ?? row.summary ?? '');
      const link = typeof row.link === 'string' ? row.link : String((row.link as Record<string, unknown>)?.['@_href'] ?? '');

      const parsedHead = parseCompanyAndLocation(titleRaw);
      const normalizedSummary = normalizeText(summary);
      const normalizedTitle = normalizeText(titleRaw);
      const stableFallbackId = hashableKey([link]) || `${source}-${parsedHead.title}`;
      const locationHint =
        parsedHead.locationText ??
        (normalizedSummary.includes('ireland') || normalizedTitle.includes('ireland')
          ? 'Ireland'
          : queryLocationHint);

      return {
        provider: source,
        providerJobId: String(row.guid ?? row.id ?? stableFallbackId),
        sourceUrl: link,
        applyUrl: link,
        title: parsedHead.title,
        company: parsedHead.company,
        locationText: locationHint,
        postedText: String(row.pubDate ?? row.published ?? row.updated ?? ''),
        postedAt: parsePostedAt(String(row.pubDate ?? row.published ?? row.updated ?? '')),
        description: summary,
        rawPayload: row
      } as RawProviderJob;
    });

    return { jobs };
  } catch (error) {
    return {
      jobs: [],
      error: error instanceof Error ? error.message : 'Unknown RSS parsing error'
    };
  }
}
