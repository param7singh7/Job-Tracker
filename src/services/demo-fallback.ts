import { createHash } from 'crypto';
import { JobStatus, MatchLevel, ScanStatus, SourceName } from '@prisma/client';
import { subDays, startOfDay } from 'date-fns';
import {
  DESCRIPTION_SIGNAL_KEYWORDS,
  STRETCH_ROLE_KEYWORDS,
  TITLE_POSITIVE_KEYWORDS
} from '@/src/config/keywords';
import { locationLooksIrish } from '@/src/config/locations';
import { MOCK_PROVIDER_JOBS } from '@/src/mock/jobs';
import { env } from '@/src/lib/env';
import { includesAny, normalizeText } from '@/src/lib/text';
import { isAllowedWorkMode } from '@/src/lib/work-mode-filter';
import { deduplicateJobs } from '@/src/services/deduplication-engine';
import { dedupeJobsForDisplayWithOptions } from '@/src/services/display-dedupe';
import type { JobsQuery } from '@/src/services/job-service';
import { normalizeProviderJob } from '@/src/services/normalization-service';
import { scoreJob } from '@/src/services/scoring-engine';
import type { ScoredJob } from '@/src/types/job';

interface DemoUserState {
  status: JobStatus;
  isSaved: boolean;
  isDismissed: boolean;
  isApplied: boolean;
  notes: string | null;
  followUpAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  reviewedAt: Date | null;
}

interface DemoJobSource {
  sourceName: SourceName;
  sourceUrl: string | null;
  applyUrl: string | null;
  sourcePostedAt: Date | null;
  sourcePostedText: string | null;
}

interface DemoJob {
  id: string;
  canonicalKey: string;
  title: string;
  titleNormalized: string;
  companyNameCached: string;
  locationText: string | null;
  city: string | null;
  county: string | null;
  country: string | null;
  workMode: string;
  employmentType: string;
  seniorityLevel: string;
  descriptionRaw: string | null;
  descriptionClean: string | null;
  postedAt: Date | null;
  discoveredAt: Date;
  sourcePrimary: SourceName;
  applyUrl: string | null;
  relevanceScore: number;
  urgencyScore: number;
  titleMatchScore: number;
  skillsMatchScore: number;
  seniorityFitScore: number;
  eligibilityScore: number;
  recencyScore: number;
  finalScore: number;
  matchLevel: MatchLevel;
  classification: 'RELEVANT' | 'ADJACENT' | 'EXCLUDED';
  sponsorshipMentioned: boolean;
  workAuthorizationMentioned: boolean;
  extractedSkillsJson: string[];
  matchedKeywordsJson: string[];
  excludedKeywordsJson: string[];
  scoringReasonsJson: string[];
  classificationReason: string;
  scanConfidence: number;
  duplicateGroupId: string | null;
  createdAt: Date;
  updatedAt: Date;
  jobSources: DemoJobSource[];
  userStates: DemoUserState[];
  company: { name: string };
  skills: Array<{ skill: string }>;
}

export interface DemoSourceStatus {
  source: SourceName;
  status: ScanStatus;
  fetched: number;
  parsed: number;
  duplicates: number;
  errors: string[];
}

interface DemoScanMeta {
  id: string;
  totalFetched: number;
  totalCreated: number;
  totalUpdated: number;
  totalDuplicates: number;
  failedSources: number;
  sourceStatuses: DemoSourceStatus[];
  usedMock: boolean;
}

type DemoState = {
  jobs: DemoJob[];
  initializedAt: Date | null;
  lastScanAt: Date | null;
  scanMeta: DemoScanMeta | null;
  schemaVersion: string | null;
};

const DEMO_SCHEMA_VERSION = '2026-03-18-role-universe-v4';
const DEMO_ENABLED_SOURCES: SourceName[] = [SourceName.LINKEDIN, SourceName.GLASSDOOR];
const DEMO_ENABLED_SOURCE_SET = new Set(DEMO_ENABLED_SOURCES);

const globalDemoState = globalThis as typeof globalThis & {
  __jobRadarDemoState?: DemoState;
};

const DEMO_STATE: DemoState = globalDemoState.__jobRadarDemoState ?? {
  jobs: [],
  initializedAt: null,
  lastScanAt: null,
  scanMeta: null,
  schemaVersion: null
};

if (!globalDemoState.__jobRadarDemoState) {
  globalDemoState.__jobRadarDemoState = DEMO_STATE;
}

function demoJobId(canonicalKey: string): string {
  const digest = createHash('sha1').update(canonicalKey).digest('hex').slice(0, 14);
  return `demo-${digest}`;
}

function defaultUserState(now: Date): DemoUserState {
  return {
    status: JobStatus.NEW,
    isSaved: false,
    isDismissed: false,
    isApplied: false,
    notes: null,
    followUpAt: null,
    firstSeenAt: now,
    lastSeenAt: now,
    reviewedAt: null
  };
}

function isSyntheticDemoJob(job: DemoJob): boolean {
  const urls = [job.applyUrl, ...job.jobSources.map((source) => source.sourceUrl), ...job.jobSources.map((source) => source.applyUrl)];
  return urls.some((url) => url?.includes('example.com/'));
}

function isAnalyticsRelevant(title: string, description?: string | null): boolean {
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description ?? '');
  const blob = `${normalizedTitle} ${normalizedDescription}`;
  const stretchByTitle =
    STRETCH_ROLE_KEYWORDS.some((x) => normalizedTitle.includes(normalizeText(x))) ||
    normalizedTitle.includes('business intelligence developer') ||
    normalizedTitle.includes('analytics engineer') ||
    normalizedTitle.includes('decision scientist') ||
    normalizedTitle.includes('product data scientist') ||
    normalizedTitle.includes('junior data engineer');
  const hardExcludesInTitle = [
    'data engineer',
    'data scientist',
    'machine learning engineer',
    'ml engineer',
    'principal ',
    ' director',
    'head of',
    'vice president',
    ' vp ',
    'research scientist',
    'deep learning',
    'nlp',
    'mlops',
    'platform engineer',
    'software engineer',
    'devops',
    'architect'
  ];

  if (hardExcludesInTitle.some((x) => normalizedTitle.includes(x)) && !stretchByTitle) {
    return false;
  }

  const nonJobSignals = ['what is ', 'course', 'training', 'certification', 'blog', 'news', 'tutorial'];
  if (nonJobSignals.some((x) => blob.includes(x))) {
    return false;
  }

  const titleMatches = includesAny(normalizedTitle, TITLE_POSITIVE_KEYWORDS);
  if (titleMatches.length || normalizedTitle.includes('analyst')) {
    return true;
  }

  if (stretchByTitle) {
    const stretchSkillSignals = includesAny(blob, [
      'sql',
      'power bi',
      'power platform',
      'power apps',
      'power automate',
      'dax',
      'tableau',
      'dashboard',
      'reporting',
      'insights',
      'kpi'
    ]);

    if (stretchSkillSignals.length >= 2) {
      return true;
    }
  }

  const descriptionMatches = includesAny(normalizedDescription, DESCRIPTION_SIGNAL_KEYWORDS);
  const analyticsRoleSignals = includesAny(blob, [
    'analyst',
    'analytics',
    'insights',
    'reporting',
    'business intelligence',
    'dashboard',
    'sql',
    'power bi',
    'power platform',
    'power apps',
    'power automate',
    'dax',
    'tableau',
    'kpi',
    'data quality',
    'decision support',
    'operations analyst',
    'risk analyst',
    'fraud analyst'
  ]);
  const jobIntentSignals = [
    'job',
    'position',
    'vacancy',
    'apply',
    'requirements',
    'responsibilities',
    'full time',
    'contract',
    'hybrid',
    'remote',
    'experience'
  ];
  const intentMatches = includesAny(normalizedDescription, jobIntentSignals);

  if (descriptionMatches.length >= 2 && analyticsRoleSignals.length >= 2 && intentMatches.length >= 2) {
    return true;
  }

  if (normalizedTitle.includes('business analyst')) {
    return descriptionMatches.length >= 2 || analyticsRoleSignals.length >= 3;
  }

  return false;
}

function isIrelandScoped(country?: string | null, locationText?: string | null): boolean {
  if (country?.toLowerCase() === 'ireland') {
    return true;
  }

  return locationLooksIrish(locationText ?? undefined);
}

function isWithinPostedWindow(postedAt?: Date | null): boolean {
  if (!env.minPostedAt || !postedAt) {
    return true;
  }

  return postedAt >= env.minPostedAt;
}

function buildJobsFromGroups(
  groups: Array<{ canonical: ScoredJob; members: ScoredJob[] }>,
  options?: {
    preserveUnseen?: boolean;
  }
): {
  jobs: DemoJob[];
  totalCreated: number;
  totalUpdated: number;
} {
  const preserveUnseen = options?.preserveUnseen ?? true;
  const previousByCanonicalKey = new Map(DEMO_STATE.jobs.map((job) => [job.canonicalKey, job]));
  const now = new Date();

  let totalCreated = 0;
  let totalUpdated = 0;

  const incomingJobs = groups
    .filter(
      (group) =>
        group.canonical.score.classification !== 'EXCLUDED' &&
        isAnalyticsRelevant(group.canonical.title, group.canonical.descriptionClean) &&
        isIrelandScoped(group.canonical.country, group.canonical.locationText) &&
        isWithinPostedWindow(group.canonical.postedAt) &&
        isAllowedWorkMode(group.canonical.workMode, group.canonical.locationText, group.canonical.country)
    )
    .map((group) => {
      const canonical = group.canonical;
      const existing = previousByCanonicalKey.get(canonical.canonicalKey);

      if (existing) {
        totalUpdated += 1;
      } else {
        totalCreated += 1;
      }

      const preservedState = existing?.userStates[0];
      const state: DemoUserState = preservedState
        ? {
            ...preservedState,
            lastSeenAt: now
          }
        : defaultUserState(now);

      return {
        id: existing?.id ?? demoJobId(canonical.canonicalKey),
        canonicalKey: canonical.canonicalKey,
        title: canonical.title,
        titleNormalized: canonical.titleNormalized,
        companyNameCached: canonical.companyName,
        locationText: canonical.locationText ?? null,
        city: canonical.city ?? null,
        county: canonical.county ?? null,
        country: canonical.country ?? null,
        workMode: canonical.workMode,
        employmentType: canonical.employmentType,
        seniorityLevel: canonical.seniorityLevel,
        descriptionRaw: canonical.descriptionRaw ?? null,
        descriptionClean: canonical.descriptionClean ?? null,
        postedAt: canonical.postedAt ?? null,
        discoveredAt: existing?.discoveredAt ?? canonical.discoveredAt,
        sourcePrimary: canonical.sourcePrimary,
        applyUrl: canonical.applyUrl ?? null,
        relevanceScore: canonical.score.relevance_score,
        urgencyScore: canonical.score.urgency_score,
        titleMatchScore: canonical.score.title_match_score,
        skillsMatchScore: canonical.score.skills_match_score,
        seniorityFitScore: canonical.score.seniority_fit_score,
        eligibilityScore: canonical.score.eligibility_score,
        recencyScore: canonical.score.recency_score,
        finalScore: canonical.score.final_score,
        matchLevel: canonical.score.match_level,
        classification: canonical.score.classification,
        sponsorshipMentioned: canonical.sponsorshipMentioned,
        workAuthorizationMentioned: canonical.workAuthorizationMentioned,
        extractedSkillsJson: canonical.extractedSkills,
        matchedKeywordsJson: canonical.matchedKeywords,
        excludedKeywordsJson: canonical.excludedKeywords,
        scoringReasonsJson: canonical.score.reasons,
        classificationReason: canonical.score.classificationReason,
        scanConfidence: canonical.scanConfidence,
        duplicateGroupId: canonical.duplicateGroupId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        jobSources: group.members.map((member) => ({
          sourceName: member.sourcePrimary,
          sourceUrl: member.sourceUrl ?? null,
          applyUrl: member.applyUrl ?? null,
          sourcePostedAt: member.postedAt ?? null,
          sourcePostedText: member.postedAt?.toISOString() ?? null
        })),
        userStates: [state],
        company: {
          name: canonical.companyName
        },
        skills: canonical.extractedSkills.map((skill) => ({ skill }))
      } as DemoJob;
    });

  const seenKeys = new Set(incomingJobs.map((job) => job.canonicalKey));
  const preservedJobs = preserveUnseen
    ? [...previousByCanonicalKey.values()].filter(
        (job) =>
          !seenKeys.has(job.canonicalKey) &&
          !isSyntheticDemoJob(job) &&
          isAnalyticsRelevant(job.title, job.descriptionClean) &&
          isIrelandScoped(job.country, job.locationText) &&
          isWithinPostedWindow(job.postedAt) &&
          isAllowedWorkMode(job.workMode, job.locationText, job.country)
      )
    : [];

  const jobs = [...incomingJobs, ...preservedJobs].sort((a, b) => {
    const bTime = b.postedAt?.getTime() ?? 0;
    const aTime = a.postedAt?.getTime() ?? 0;
    if (bTime !== aTime) {
      return bTime - aTime;
    }

    return b.finalScore - a.finalScore;
  });

  return {
    jobs,
    totalCreated,
    totalUpdated
  };
}

function saveScanMeta(meta: DemoScanMeta) {
  DEMO_STATE.scanMeta = meta;
  DEMO_STATE.lastScanAt = new Date();
}

function ensureData(): DemoJob[] {
  if (DEMO_STATE.schemaVersion !== DEMO_SCHEMA_VERSION) {
    DEMO_STATE.jobs = [];
    DEMO_STATE.initializedAt = null;
    DEMO_STATE.lastScanAt = null;
    DEMO_STATE.scanMeta = null;
    DEMO_STATE.schemaVersion = DEMO_SCHEMA_VERSION;
  }

  if (DEMO_STATE.jobs.length) {
    DEMO_STATE.jobs = DEMO_STATE.jobs.map((job) => {
      const expectedId = demoJobId(job.canonicalKey);
      if (job.id === expectedId) {
        return job;
      }

      return {
        ...job,
        id: expectedId
      };
    });

    return DEMO_STATE.jobs;
  }

  if (!env.enableMockMode) {
    DEMO_STATE.jobs = [];
    DEMO_STATE.schemaVersion = DEMO_SCHEMA_VERSION;
    DEMO_STATE.initializedAt = DEMO_STATE.initializedAt ?? new Date();
    return DEMO_STATE.jobs;
  }

  const mockJobs = MOCK_PROVIDER_JOBS.filter((raw) => DEMO_ENABLED_SOURCE_SET.has(raw.provider));
  const scored = mockJobs.map((raw) => {
    const normalized = normalizeProviderJob(raw);
    return {
      ...normalized,
      score: scoreJob(normalized)
    };
  });

  const deduped = deduplicateJobs(scored);
  const built = buildJobsFromGroups(deduped.groups);

  DEMO_STATE.jobs = built.jobs;
  DEMO_STATE.initializedAt = new Date();
  DEMO_STATE.schemaVersion = DEMO_SCHEMA_VERSION;

  const sourceStatuses = DEMO_ENABLED_SOURCES
    .map((source) => ({
      source,
      status: ScanStatus.SUCCESS,
      fetched: mockJobs.filter((job) => job.provider === source).length,
      parsed: mockJobs.filter((job) => job.provider === source).length,
      duplicates: 0,
      errors: [] as string[]
    }));

  saveScanMeta({
    id: 'demo-scan-run',
    totalFetched: mockJobs.length,
    totalCreated: built.totalCreated,
    totalUpdated: built.totalUpdated,
    totalDuplicates: deduped.duplicates,
    failedSources: 0,
    sourceStatuses,
    usedMock: true
  });

  return DEMO_STATE.jobs;
}

export function hydrateDemoFromScannedGroups(input: {
  scanRunId: string;
  groups: Array<{ canonical: ScoredJob; members: ScoredJob[] }>;
  totalFetched: number;
  totalDuplicates: number;
  failedSources: number;
  sourceStatuses: DemoSourceStatus[];
}) {
  const preserveUnseen = !(DEMO_STATE.scanMeta?.usedMock ?? false);
  const built = buildJobsFromGroups(input.groups, { preserveUnseen });

  DEMO_STATE.jobs = built.jobs;
  DEMO_STATE.initializedAt = DEMO_STATE.initializedAt ?? new Date();
  DEMO_STATE.schemaVersion = DEMO_SCHEMA_VERSION;

  saveScanMeta({
    id: input.scanRunId,
    totalFetched: input.totalFetched,
    totalCreated: built.totalCreated,
    totalUpdated: built.totalUpdated,
    totalDuplicates: input.totalDuplicates,
    failedSources: input.failedSources,
    sourceStatuses: input.sourceStatuses,
    usedMock: false
  });

  return {
    totalCreated: built.totalCreated,
    totalUpdated: built.totalUpdated
  };
}

function applyRange(dateRange?: JobsQuery['dateRange']): Date | null {
  if (!dateRange || dateRange === 'all') {
    return null;
  }

  if (dateRange === 'since2026') {
    return new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
  }

  if (dateRange === 'sinceMar2026') {
    return new Date(Date.UTC(2026, 2, 1, 0, 0, 0));
  }

  if (dateRange === 'sinceFeb9') {
    return new Date(Date.UTC(2026, 1, 9, 0, 0, 0));
  }

  if (dateRange === 'sinceFeb2026') {
    return new Date(Date.UTC(2026, 1, 1, 0, 0, 0));
  }

  const now = new Date();
  if (dateRange === 'today') {
    return startOfDay(now);
  }

  if (dateRange === 'yesterday') {
    return startOfDay(subDays(now, 1));
  }

  const ranges: Record<'last1' | 'last3' | 'last7' | 'last14' | 'last30', number> = {
    last1: 1,
    last3: 3,
    last7: 7,
    last14: 14,
    last30: 30
  };

  if (dateRange in ranges) {
    return subDays(now, ranges[dateRange as keyof typeof ranges]);
  }

  return null;
}

function filterJobs(filters: JobsQuery): DemoJob[] {
  const jobs = ensureData();
  const since = applyRange(filters.dateRange);

  return jobs.filter((job) => {
    if (job.classification === 'EXCLUDED') {
      return false;
    }

    if (filters.keyword) {
      const needle = filters.keyword.toLowerCase();
      const blob = `${job.title} ${job.companyNameCached} ${job.descriptionClean ?? ''}`.toLowerCase();
      if (!blob.includes(needle)) {
        return false;
      }
    }

    if (filters.source && !job.jobSources.some((source) => source.sourceName === filters.source)) {
      return false;
    }

    if (filters.location) {
      const location = `${job.city ?? ''} ${job.county ?? ''} ${job.locationText ?? ''}`.toLowerCase();
      if (!location.includes(filters.location.toLowerCase())) {
        return false;
      }
    }

    if (filters.workMode && job.workMode !== filters.workMode) {
      return false;
    }

    if (filters.matchLevel && job.matchLevel !== filters.matchLevel) {
      return false;
    }

    if (filters.minScore && job.finalScore < filters.minScore) {
      return false;
    }

    if (since && job.postedAt && job.postedAt < since) {
      return false;
    }

    const state = job.userStates[0];

    if (filters.status && state.status !== filters.status) {
      return false;
    }

    if (filters.unreviewedOnly && state.reviewedAt !== null) {
      return false;
    }

    if (filters.includeStretch === false && job.matchLevel === MatchLevel.STRETCH) {
      return false;
    }

    if (filters.includeContract === false && job.employmentType === 'CONTRACT') {
      return false;
    }

    if (filters.includeRemoteIrelandOnly === true) {
      if (!isAllowedWorkMode(job.workMode, job.locationText, job.country) || job.workMode !== 'REMOTE') {
        return false;
      }
    }

    if (!isAllowedWorkMode(job.workMode, job.locationText, job.country)) {
      return false;
    }

    return true;
  });
}

export function queryDemoJobs(filters: JobsQuery) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 25));

  const filtered = filterJobs(filters);
  const deduped = dedupeJobsForDisplayWithOptions(filtered, {
    collapseMultiLocationDuplicates: filters.collapseMultiLocationDuplicates ?? false
  });
  const total = deduped.length;

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    jobs: deduped.slice((page - 1) * pageSize, page * pageSize)
  };
}

export function getDemoJobById(id: string) {
  const jobs = ensureData();
  return jobs.find((job) => job.id === id) ?? null;
}

export function updateDemoJobState(
  jobId: string,
  input: Partial<{
    status: JobStatus;
    isSaved: boolean;
    isDismissed: boolean;
    isApplied: boolean;
    notes: string;
    followUpAt: string | null;
  }>
) {
  const jobs = ensureData();
  const job = jobs.find((row) => row.id === jobId);

  if (!job) {
    return null;
  }

  const state = job.userStates[0];
  state.status = input.status ?? state.status;
  state.isSaved = input.isSaved ?? state.isSaved;
  state.isDismissed = input.isDismissed ?? state.isDismissed;
  state.isApplied = input.isApplied ?? state.isApplied;
  state.notes = input.notes ?? state.notes;
  state.followUpAt = input.followUpAt ? new Date(input.followUpAt) : state.followUpAt;
  state.reviewedAt = new Date();
  state.lastSeenAt = new Date();

  return state;
}

export function getDemoSourceStats() {
  const jobs = ensureData();
  const counts = new Map<SourceName, number>();

  for (const job of jobs) {
    for (const source of job.jobSources) {
      counts.set(source.sourceName, (counts.get(source.sourceName) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([source, count]) => ({ source, count }));
}

export function getDemoLocationStats() {
  const jobs = ensureData();
  const counts = new Map<string, number>();

  for (const job of jobs) {
    const location = job.city ?? 'Unknown';
    counts.set(location, (counts.get(location) ?? 0) + 1);
  }

  return [...counts.entries()].map(([location, count]) => ({ location, count }));
}

export function getDemoDashboardStats(lastVisitAt?: Date) {
  const jobs = ensureData();
  const now = new Date();
  const since = lastVisitAt ?? subDays(now, 1);

  const newToday = jobs.filter((job) => {
    const referenceDate = job.postedAt ?? job.discoveredAt;
    return referenceDate.toDateString() === now.toDateString();
  }).length;
  const newSinceLastVisit = jobs.filter((job) => job.discoveredAt >= since).length;

  const applyNow = jobs.filter((job) => job.matchLevel === MatchLevel.APPLY_NOW).length;
  const strong = jobs.filter((job) => job.matchLevel === MatchLevel.STRONG_MATCH).length;
  const unreviewed = jobs.filter((job) => job.userStates[0].reviewedAt === null).length;
  const saved = jobs.filter((job) => job.userStates[0].isSaved).length;
  const applied = jobs.filter((job) => job.userStates[0].isApplied).length;
  const dismissedToday = jobs.filter(
    (job) =>
      job.userStates[0].isDismissed &&
      job.userStates[0].lastSeenAt.toDateString() === new Date().toDateString()
  ).length;

  const jobsBySource = getDemoSourceStats();
  const jobsByLocation = getDemoLocationStats();
  const matchMap = new Map<string, number>();
  for (const job of jobs) {
    matchMap.set(job.matchLevel, (matchMap.get(job.matchLevel) ?? 0) + 1);
  }

  const companyMap = new Map<string, { count: number; lastSeenAt: Date }>();
  for (const job of jobs) {
    const current = companyMap.get(job.companyNameCached);
    if (!current) {
      companyMap.set(job.companyNameCached, { count: 1, lastSeenAt: job.discoveredAt });
      continue;
    }

    current.count += 1;
    if (job.discoveredAt > current.lastSeenAt) {
      current.lastSeenAt = job.discoveredAt;
    }
  }

  const latestStatuses = DEMO_STATE.scanMeta?.sourceStatuses ?? [];
  const recentlyFailingSources = latestStatuses
    .filter((row) => row.status !== ScanStatus.SUCCESS || row.errors.length > 0)
    .map((row) => ({
      name: row.source,
      lastError: row.errors[0] ?? null
    }));

  const sourcesScannedSuccessfully = latestStatuses.length
    ? latestStatuses.filter((row) => row.status !== ScanStatus.FAILED).length
    : DEMO_ENABLED_SOURCES.length;

  return {
    generatedAt: now,
    newToday,
    newSinceLastVisit,
    totalActiveRelevantJobs: jobs.length,
    applyNowCount: applyNow,
    strongMatchesCount: strong,
    unreviewedCount: unreviewed,
    savedJobs: saved,
    appliedJobs: applied,
    dismissedToday,
    sourcesScannedSuccessfully,
    jobsBySource,
    jobsByLocation,
    jobsByMatchLevel: [...matchMap.entries()].map(([matchLevel, count]) => ({ matchLevel, count })),
    companiesHiringFrequently: [...companyMap.entries()]
      .filter(([, data]) => data.count >= 2)
      .map(([company, data]) => ({
        company,
        rolesOpen: data.count,
        lastSeenAt: data.lastSeenAt
      }))
      .sort((a, b) => b.rolesOpen - a.rolesOpen),
    recentlyFailingSources,
    dailyDigest: {
      status: recentlyFailingSources.length ? ScanStatus.PARTIAL_FAILURE : ScanStatus.SUCCESS,
      highlights: [
        `${newToday} new jobs today`,
        `${applyNow} apply-now opportunities`,
        `${strong} strong matches ready for review`
      ]
    }
  };
}

function healthFromStatus(status: ScanStatus, hasErrors: boolean): 'HEALTHY' | 'DEGRADED' | 'DOWN' {
  if (status === ScanStatus.FAILED) {
    return 'DOWN';
  }

  if (status === ScanStatus.PARTIAL_FAILURE || hasErrors) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

export function getDemoSourceHealth() {
  ensureData();

  const statuses = DEMO_STATE.scanMeta?.sourceStatuses ?? [];
  const now = DEMO_STATE.lastScanAt ?? new Date();

  return DEMO_ENABLED_SOURCES
    .map((source) => {
      const row = statuses.find((item) => item.source === source);
      const fetched = row?.fetched ?? 0;
      const parsed = row?.parsed ?? 0;

      return {
        source,
        health: row ? healthFromStatus(row.status, row.errors.length > 0) : 'HEALTHY',
        enabled: true,
        mockMode: DEMO_STATE.scanMeta?.usedMock ?? true,
        lastSuccessfulScan: row && row.status !== ScanStatus.FAILED ? now : null,
        lastScanAttemptAt: now,
        lastError: row?.errors[0] ?? null,
        latestResult: {
          status: row?.status ?? ScanStatus.SUCCESS,
          fetchedCount: fetched,
          parsedCount: parsed,
          duplicateCount: row?.duplicates ?? 0,
          errorCount: row?.errors.length ?? 0,
          durationMs: 120,
          scanRunId: DEMO_STATE.scanMeta?.id ?? 'demo-scan-run',
          createdAt: now
        }
      };
    });
}

export function runDemoScan() {
  ensureData();
  const mockJobs = MOCK_PROVIDER_JOBS.filter((raw) => DEMO_ENABLED_SOURCE_SET.has(raw.provider));

  const meta = DEMO_STATE.scanMeta;
  if (!meta) {
    return {
      scanRunId: 'demo-scan-run',
      totalFetched: mockJobs.length,
      totalCreated: DEMO_STATE.jobs.length,
      totalUpdated: 0,
      totalDuplicates: 0,
      failedSources: 0,
      sourceStatuses: []
    };
  }

  return {
    scanRunId: meta.id,
    totalFetched: meta.totalFetched,
    totalCreated: meta.totalCreated,
    totalUpdated: meta.totalUpdated,
    totalDuplicates: meta.totalDuplicates,
    failedSources: meta.failedSources,
    sourceStatuses: meta.sourceStatuses
  };
}

export function getDemoLatestScanSummary() {
  ensureData();
  const mockJobs = MOCK_PROVIDER_JOBS.filter((raw) => DEMO_ENABLED_SOURCE_SET.has(raw.provider));

  const meta = DEMO_STATE.scanMeta;
  return {
    id: meta?.id ?? 'demo-scan-run',
    totalFetched: meta?.totalFetched ?? mockJobs.length,
    totalCreated: meta?.totalCreated ?? DEMO_STATE.jobs.length,
    totalUpdated: meta?.totalUpdated ?? 0,
    totalDuplicates: meta?.totalDuplicates ?? 0,
    sourceResults: []
  };
}
