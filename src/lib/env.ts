import { SourceName } from '@prisma/client';

function parseOptionalDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function parseOptionalNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function normalizeMode(value: string | undefined): 'live' | 'mock' | 'off' {
  if (!value) {
    return 'mock';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'live' || normalized === 'mock' || normalized === 'off') {
    return normalized;
  }

  return 'mock';
}

function normalizeLinkedInStrategy(value: string | undefined): 'targeted' | 'exhaustive' {
  const normalized = (value ?? '').toLowerCase().trim();
  if (normalized === 'exhaustive') {
    return 'exhaustive';
  }

  return 'targeted';
}

const PROVIDER_ENV_KEY: Record<SourceName, string> = {
  LINKEDIN: 'PROVIDER_LINKEDIN_MODE',
  JOBSIRELAND: 'PROVIDER_JOBSIRELAND_MODE',
  GLASSDOOR: 'PROVIDER_GLASSDOOR_MODE',
  IRISHJOBS: 'PROVIDER_IRISHJOBS_MODE',
  INDEED: 'PROVIDER_INDEED_MODE',
  MOCK: 'PROVIDER_MOCK_MODE'
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  enableMockMode: (process.env.ENABLE_MOCK_MODE ?? 'true').toLowerCase() === 'true',
  scanMaxPages: Number(process.env.SCAN_MAX_PAGES ?? 8),
  scanTimeoutMs: Number(process.env.SCAN_TIMEOUT_MS ?? 12000),
  providerFetchTimeoutMs: parseOptionalNumber(process.env.PROVIDER_FETCH_TIMEOUT_MS, 900000),
  providerBackfillMinJobs: Number(process.env.PROVIDER_BACKFILL_MIN_JOBS ?? 110),
  minPostedAt: parseOptionalDate(process.env.MIN_POSTED_AT),
  linkedinScanStrategy: normalizeLinkedInStrategy(process.env.LINKEDIN_SCAN_STRATEGY),
  linkedinMaxKeywords: parseOptionalNumber(process.env.LINKEDIN_MAX_KEYWORDS, 0),
  linkedinMaxPagesPerKeyword: parseOptionalNumber(process.env.LINKEDIN_MAX_PAGES_PER_KEYWORD, 20),
  linkedinStopAfterEmptyPages: parseOptionalNumber(process.env.LINKEDIN_STOP_AFTER_EMPTY_PAGES, 2),
  linkedinMaxTotalRequests: parseOptionalNumber(process.env.LINKEDIN_MAX_TOTAL_REQUESTS, 1500),
  linkedinRequestDelayMs: parseOptionalNumber(process.env.LINKEDIN_REQUEST_DELAY_MS, 650),
  linkedinKeywordDelayMs: parseOptionalNumber(process.env.LINKEDIN_KEYWORD_DELAY_MS, 1200),
  linkedinUseBingSupplement: (process.env.LINKEDIN_USE_BING_SUPPLEMENT ?? 'true').toLowerCase() === 'true',
  cronSchedule: process.env.SCAN_CRON ?? '0 */6 * * *',
  dailyTargetFetched: parseOptionalNumber(process.env.DAILY_TARGET_FETCHED, 600),
  dailyTargetParsed: parseOptionalNumber(process.env.DAILY_TARGET_PARSED, 300),
  dailyTargetLinkedinVisible: parseOptionalNumber(process.env.DAILY_TARGET_LINKEDIN_VISIBLE, 220),
  csvExportEnabled: (process.env.CSV_EXPORT_ENABLED ?? 'true').toLowerCase() === 'true',
  csvExportDir: process.env.CSV_EXPORT_DIR ?? 'exports',
  linkedinFeedUrl: process.env.LINKEDIN_FEED_URL,
  linkedinCookie: process.env.LINKEDIN_COOKIE,
  jobsIrelandFeedUrl: process.env.JOBSIRELAND_FEED_URL,
  glassdoorFeedUrl: process.env.GLASSDOOR_FEED_URL,
  irishJobsFeedUrl: process.env.IRISHJOBS_FEED_URL,
  indeedFeedUrl: process.env.INDEED_FEED_URL,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  digestEmailTo: process.env.DIGEST_EMAIL_TO,
  webhooks: (process.env.WEBHOOK_URLS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
};

export function providerMode(provider: SourceName): 'live' | 'mock' | 'off' {
  return normalizeMode(process.env[PROVIDER_ENV_KEY[provider]]);
}
