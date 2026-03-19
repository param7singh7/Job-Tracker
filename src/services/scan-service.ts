import {
  Classification,
  MatchLevel,
  Prisma,
  ProviderHealth,
  ScanStatus,
  SourceName,
  WorkMode
} from '@prisma/client';
import { startOfDay, subDays } from 'date-fns';
import {
  DESCRIPTION_SIGNAL_KEYWORDS,
  ROLE_FAMILY_CLUSTERS,
  RESPONSIBILITY_KEYWORDS,
  SEARCH_KEYWORD_GROUPS,
  SUPPORT_ANALYTICS_BRIDGE_KEYWORDS,
  SUPPORT_EXCLUDE_KEYWORDS,
  STRETCH_ROLE_KEYWORDS,
  TOOL_KEYWORDS,
  TITLE_POSITIVE_KEYWORDS
} from '@/src/config/keywords';
import { DEFAULT_SEARCH_CONFIG } from '@/src/config/default-search-config';
import { locationLooksIrish } from '@/src/config/locations';
import { backfillProviderJobs } from '@/src/adapters/utils';
import { env, providerMode } from '@/src/lib/env';
import { prisma } from '@/src/lib/prisma';
import { includesAny, normalizeText } from '@/src/lib/text';
import { logger } from '@/src/lib/logger';
import { isAllowedWorkMode } from '@/src/lib/work-mode-filter';
import { allAdapters } from '@/src/services/adapter-registry';
import type { JobProviderAdapter } from '@/src/adapters/base';
import { deduplicateJobs } from '@/src/services/deduplication-engine';
import { getDemoLatestScanSummary, hydrateDemoFromScannedGroups, runDemoScan } from '@/src/services/demo-fallback';
import { normalizeProviderJob } from '@/src/services/normalization-service';
import { exportPriorityCsvFromDatabase, exportPriorityCsvFromGroups } from '@/src/services/csv-export-service';
import { matchKeywords } from '@/src/services/keyword-matcher';
import { scoreJob } from '@/src/services/scoring-engine';
import { ProviderFetchContext, ProviderFetchResult, ScoredJob } from '@/src/types/job';

function mapProviderHealth(health: 'healthy' | 'degraded' | 'down' | 'disabled'): ProviderHealth {
  if (health === 'healthy') {
    return ProviderHealth.HEALTHY;
  }

  if (health === 'degraded') {
    return ProviderHealth.DEGRADED;
  }

  if (health === 'down') {
    return ProviderHealth.DOWN;
  }

  return ProviderHealth.DISABLED;
}

function scanStatusFromResult(errors: string[], fetched: number): ScanStatus {
  if (errors.length && fetched === 0) {
    return ScanStatus.FAILED;
  }

  if (errors.length) {
    return ScanStatus.PARTIAL_FAILURE;
  }

  return ScanStatus.SUCCESS;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

interface SourceStatusRow {
  source: SourceName;
  status: ScanStatus;
  fetched: number;
  parsed: number;
  duplicates: number;
  created: number;
  updated: number;
  errors: string[];
  pipeline: {
    afterRoleFilter: number;
    afterPostedWindow: number;
    afterLocationFilter: number;
    droppedByRole: number;
    droppedByPostedWindow: number;
    droppedByLocation: number;
    droppedByNonJobSignal: number;
    droppedByWeakSignal: number;
    droppedBySupportWithoutAnalytics: number;
    titleOnlyMatchCount: number;
    descriptionOnlyMatchCount: number;
    titleAndDescriptionMatchCount: number;
    roleFamilyHitCounts: Record<string, number>;
    dropReasons: {
      nonJobSignal: number;
      weakSignal: number;
      supportWithoutAnalytics: number;
      postedWindow: number;
      location: number;
    };
  };
}

async function getLinkedInVisibleCountFromDatabase(): Promise<number> {
  const since7d = startOfDay(subDays(new Date(), 7));
  return prisma.job.count({
    where: {
      classification: { not: Classification.EXCLUDED },
      postedAt: { gte: since7d },
      jobSources: {
        some: {
          sourceName: SourceName.LINKEDIN
        }
      }
    }
  });
}

async function executeAdapterFetch(
  adapter: JobProviderAdapter,
  context: ProviderFetchContext
): Promise<{ adapter: SourceName; result: ProviderFetchResult; duration: number }> {
  const started = Date.now();
  const timeoutMs = Math.max(context.timeoutMs, env.providerFetchTimeoutMs);

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error(`Provider timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    logger.info('provider scan started', {
      provider: adapter.source,
      keywordCount: context.keywords.length,
      timeoutMs
    });

    const result = await Promise.race([adapter.fetch(context), timeoutPromise]);
    const duration = Date.now() - started;
    logger.info('provider scan completed', {
      provider: adapter.source,
      durationMs: duration,
      fetched: result.jobs.length,
      errors: result.errors.length
    });

    return {
      adapter: adapter.source,
      result,
      duration
    };
  } catch (error) {
    const duration = Date.now() - started;
    const message = error instanceof Error ? error.message : 'Unknown provider error';
    logger.warn('provider scan failed', {
      provider: adapter.source,
      durationMs: duration,
      error: message
    });

    return {
      adapter: adapter.source,
      result: {
        provider: adapter.source,
        jobs: [],
        errors: [message],
        warnings: [],
        health: {
          provider: adapter.source,
          status: 'down'
        },
        durationMs: duration
      },
      duration
    };
  }
}

const FORCED_SOURCES = new Set(DEFAULT_SEARCH_CONFIG.includedSources);

const BROAD_DISCOVERY_KEYWORDS = [
  'analyst',
  'data',
  'data analytics',
  'data analyst',
  'business analyst',
  'systems analyst',
  'functional analyst',
  'business intelligence',
  'bi analyst',
  'insights analyst',
  'reporting analyst',
  'reporting specialist',
  'sql analyst',
  'sql developer',
  'power bi',
  'power platform',
  'power apps',
  'power automate',
  'tableau',
  'dashboard analyst',
  'data quality analyst',
  'data governance analyst',
  'decision support analyst',
  'operations analyst',
  'analytics consultant',
  'reporting consultant',
  'power bi consultant',
  'business process analyst',
  'transformation analyst',
  'compliance analyst',
  'quality reporting analyst',
  'healthcare data analyst',
  'medtech analyst',
  'fraud analytics analyst',
  'risk reporting analyst',
  'bi developer',
  'power bi developer',
  'reporting developer',
  'analytics engineer',
  'commercial analyst',
  'marketing analyst',
  'customer insights analyst',
  'risk analyst',
  'fraud analyst',
  'product analyst',
  'finance analyst',
  'sales operations analyst',
  'operations analytics reporting',
  'compliance reporting'
] as const;

function mergedKeywordUniverse(): string[] {
  return unique([...SEARCH_KEYWORD_GROUPS, ...BROAD_DISCOVERY_KEYWORDS].map((x) => x.trim()).filter(Boolean));
}

type RoleGateReason = 'eligible' | 'non_job_signal' | 'support_without_analytics' | 'insufficient_cluster_signal';
type MatchMode = 'title_only' | 'description_only' | 'title_and_description' | 'none';

interface RoleGateResult {
  eligible: boolean;
  reason: RoleGateReason;
  matchMode: MatchMode;
  roleFamilyHits: Record<string, number>;
}

function emptyRoleFamilyHitCounts(): Record<string, number> {
  return Object.fromEntries(Object.keys(ROLE_FAMILY_CLUSTERS).map((key) => [key, 0]));
}

function evaluateRoleGate(title: string, description?: string): RoleGateResult {
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description ?? '');
  const blob = `${normalizedTitle} ${normalizedDescription}`;

  const nonJobSignals = ['what is ', 'course', 'training', 'certification', 'blog', 'news', 'tutorial'];
  if (nonJobSignals.some((x) => blob.includes(x))) {
    return {
      eligible: false,
      reason: 'non_job_signal',
      matchMode: 'none',
      roleFamilyHits: emptyRoleFamilyHitCounts()
    };
  }

  const matches = matchKeywords(title, description);

  const broadTitleSignals = includesAny(normalizedTitle, [
    ...TITLE_POSITIVE_KEYWORDS,
    'analyst',
    'analytics',
    'data',
    'insight',
    'reporting',
    'business intelligence',
    'sql',
    'power bi',
    'tableau',
    'dashboard',
    'kpi'
  ]);
  const descriptionMatches = includesAny(normalizedDescription, DESCRIPTION_SIGNAL_KEYWORDS);
  const toolMatches = includesAny(normalizedDescription, TOOL_KEYWORDS);
  const responsibilityMatches = includesAny(normalizedDescription, RESPONSIBILITY_KEYWORDS);
  const supportTitleSignals = includesAny(normalizedTitle, SUPPORT_EXCLUDE_KEYWORDS);
  const supportBlobSignals = includesAny(blob, SUPPORT_EXCLUDE_KEYWORDS);
  const supportAnalyticsBridgeSignals = includesAny(blob, SUPPORT_ANALYTICS_BRIDGE_KEYWORDS);
  const roleFamilyHits = matches.roleFamilyHits;
  const roleFamilyHitTotal = Object.values(roleFamilyHits).reduce((sum, count) => sum + count, 0);
  const analyticsFamilySignal =
    (roleFamilyHits.DATA_ANALYTICS ?? 0) +
    (roleFamilyHits.BI_REPORTING ?? 0) +
    (roleFamilyHits.CONSULTING_ANALYTICS ?? 0) +
    (roleFamilyHits.HEALTHCARE_ANALYTICS ?? 0) +
    (roleFamilyHits.LIGHT_DATA_ENGINEERING ?? 0);

  const stretchByTitle =
    STRETCH_ROLE_KEYWORDS.some((x) => normalizedTitle.includes(normalizeText(x))) ||
    normalizedTitle.includes('business intelligence developer') ||
    normalizedTitle.includes('analytics engineer') ||
    normalizedTitle.includes('decision scientist') ||
    normalizedTitle.includes('product data scientist') ||
    normalizedTitle.includes('junior data engineer');

  const titleHitCount = Math.max(broadTitleSignals.length, matches.titleMatches.length);
  const descriptionHitCount = Math.max(
    descriptionMatches.length,
    matches.descriptionMatches.length + toolMatches.length + responsibilityMatches.length
  );

  const hasStrongDescriptionSignal =
    matches.descriptionMatches.length >= 2 ||
    toolMatches.length >= 2 ||
    responsibilityMatches.length >= 2 ||
    roleFamilyHitTotal >= 2;

  const combinedWeakSignal =
    matches.descriptionMatches.length + toolMatches.length + responsibilityMatches.length + roleFamilyHitTotal >= 3;

  const supportLooksPrimary = supportBlobSignals.length > 0 && supportAnalyticsBridgeSignals.length < 2 && analyticsFamilySignal < 2;
  const supportOnlyTitle = supportTitleSignals.length > 0 && titleHitCount <= supportTitleSignals.length && descriptionHitCount < 2;
  if (supportLooksPrimary || supportOnlyTitle) {
    return {
      eligible: false,
      reason: 'support_without_analytics',
      matchMode: 'none',
      roleFamilyHits
    };
  }

  const eligible =
    titleHitCount > 0 || hasStrongDescriptionSignal || combinedWeakSignal || (stretchByTitle && descriptionHitCount > 0);
  if (!eligible) {
    return {
      eligible: false,
      reason: 'insufficient_cluster_signal',
      matchMode: 'none',
      roleFamilyHits
    };
  }

  const matchMode: MatchMode =
    titleHitCount > 0 && descriptionHitCount > 0
      ? 'title_and_description'
      : titleHitCount > 0
        ? 'title_only'
        : descriptionHitCount > 0
          ? 'description_only'
          : 'none';

  return {
    eligible: true,
    reason: 'eligible',
    matchMode,
    roleFamilyHits
  };
}

async function ensureSourceRecords(): Promise<Map<SourceName, { id: string }>> {
  const entries = [...DEFAULT_SEARCH_CONFIG.includedSources];

  for (const sourceName of entries) {
    const mode = providerMode(sourceName);
    await prisma.source.upsert({
      where: { name: sourceName },
      update: {
        enabled: mode !== 'off',
        mockMode: mode === 'mock'
      },
      create: {
        name: sourceName,
        health: ProviderHealth.HEALTHY,
        enabled: mode !== 'off',
        mockMode: mode === 'mock'
      }
    });
  }

  const rows = await prisma.source.findMany({
    where: {
      name: {
        in: entries
      }
    }
  });
  return new Map(rows.map((row) => [row.name, { id: row.id }]));
}

async function loadSearchConfig() {
  const config = await prisma.searchConfig.findUnique({ where: { name: 'default' } });
  if (config) {
    return config;
  }

  return prisma.searchConfig.create({
    data: {
      name: 'default',
      includedSources: DEFAULT_SEARCH_CONFIG.includedSources,
      keywordGroups: DEFAULT_SEARCH_CONFIG.keywordGroups,
      excludedKeywordGroups: DEFAULT_SEARCH_CONFIG.excludedKeywordGroups,
      locationFilters: DEFAULT_SEARCH_CONFIG.locationFilters,
      minimumScore: DEFAULT_SEARCH_CONFIG.minimumScore,
      applyNowThreshold: DEFAULT_SEARCH_CONFIG.applyNowThreshold,
      includeStretchRoles: DEFAULT_SEARCH_CONFIG.includeStretchRoles,
      includeContractJobs: DEFAULT_SEARCH_CONFIG.includeContractJobs,
      includeGraduateRoles: DEFAULT_SEARCH_CONFIG.includeGraduateRoles,
      includeRemoteIreland: DEFAULT_SEARCH_CONFIG.includeRemoteIreland,
      includeSuspiciousMatches: DEFAULT_SEARCH_CONFIG.includeSuspiciousMatches,
      refreshFrequencyMinutes: DEFAULT_SEARCH_CONFIG.refreshFrequencyMinutes
    }
  });
}

function shouldKeepLocation(locationText?: string, country?: string, workMode?: WorkMode): boolean {
  if (!isAllowedWorkMode(workMode, locationText, country)) {
    return false;
  }

  if (country?.toLowerCase() === 'ireland') {
    return true;
  }

  if (workMode === WorkMode.REMOTE && (locationText?.toLowerCase().includes('ireland') ?? false)) {
    return true;
  }

  return locationLooksIrish(locationText);
}

function isWithinPostedWindow(postedAt?: Date | null): boolean {
  if (!env.minPostedAt || !postedAt) {
    return true;
  }

  return postedAt >= env.minPostedAt;
}

async function upsertJobGroup(
  group: {
    canonical: ScoredJob;
    members: ScoredJob[];
  },
  sourceMap: Map<SourceName, { id: string }>
): Promise<'created' | 'updated'> {
  const top = group.canonical;

  const company = await prisma.company.upsert({
    where: { normalizedName: top.companyNameNormalized },
    update: {
      name: top.companyName
    },
    create: {
      name: top.companyName,
      normalizedName: top.companyNameNormalized
    }
  });

  const payload: Prisma.JobUncheckedCreateInput = {
    canonicalKey: top.canonicalKey,
    title: top.title,
    titleNormalized: top.titleNormalized,
    companyId: company.id,
    companyNameCached: top.companyName,
    locationText: top.locationText,
    city: top.city,
    county: top.county,
    country: top.country,
    workMode: top.workMode,
    employmentType: top.employmentType,
    seniorityLevel: top.seniorityLevel,
    salaryMin: top.salaryMin,
    salaryMax: top.salaryMax,
    salaryCurrency: top.salaryCurrency,
    descriptionRaw: top.descriptionRaw,
    descriptionClean: top.descriptionClean,
    postedAt: top.postedAt,
    discoveredAt: top.discoveredAt,
    sourcePrimary: top.sourcePrimary,
    applyUrl: top.applyUrl,
    relevanceScore: top.score.relevance_score,
    urgencyScore: top.score.urgency_score,
    titleMatchScore: top.score.title_match_score,
    skillsMatchScore: top.score.skills_match_score,
    seniorityFitScore: top.score.seniority_fit_score,
    eligibilityScore: top.score.eligibility_score,
    recencyScore: top.score.recency_score,
    finalScore: top.score.final_score,
    matchLevel: top.score.match_level,
    classification: top.score.classification,
    sponsorshipMentioned: top.sponsorshipMentioned,
    workAuthorizationMentioned: top.workAuthorizationMentioned,
    extractedSkillsJson: top.extractedSkills,
    matchedKeywordsJson: top.matchedKeywords,
    excludedKeywordsJson: top.excludedKeywords,
    scoringReasonsJson: top.score.reasons,
    classificationReason: top.score.classificationReason,
    scanConfidence: top.scanConfidence,
    duplicateGroupId: top.duplicateGroupId
  };

  const existing = await prisma.job.findUnique({ where: { canonicalKey: top.canonicalKey } });

  const job = await prisma.job.upsert({
    where: { canonicalKey: top.canonicalKey },
    create: payload,
    update: {
      ...payload,
      discoveredAt: existing?.discoveredAt ?? top.discoveredAt
    }
  });

  await prisma.userJobState.upsert({
    where: { jobId: job.id },
    create: {
      jobId: job.id,
      status: 'NEW',
      firstSeenAt: new Date(),
      lastSeenAt: new Date()
    },
    update: {
      lastSeenAt: new Date()
    }
  });

  await prisma.jobSkillTag.deleteMany({ where: { jobId: job.id } });
  if (top.extractedSkills.length) {
    await prisma.jobSkillTag.createMany({
      data: unique(top.extractedSkills).map((skill) => ({
        jobId: job.id,
        skill,
        weight: 1
      }))
    });
  }

  for (const member of group.members) {
    const source = sourceMap.get(member.sourcePrimary);
    if (!source) {
      continue;
    }

    await prisma.jobSource.upsert({
      where: {
        sourceId_sourceJobId: {
          sourceId: source.id,
          sourceJobId: member.sourceJobId
        }
      },
      create: {
        jobId: job.id,
        sourceId: source.id,
        sourceName: member.sourcePrimary,
        sourceJobId: member.sourceJobId,
        sourceUrl: member.sourceUrl,
        applyUrl: member.applyUrl,
        sourcePostedAt: member.postedAt,
        sourcePostedText: member.postedAt?.toISOString(),
        rawPayloadJson: {
          title: member.title,
          location: member.locationText
        }
      },
      update: {
        jobId: job.id,
        sourceName: member.sourcePrimary,
        sourceUrl: member.sourceUrl,
        applyUrl: member.applyUrl,
        sourcePostedAt: member.postedAt
      }
    });
  }

  return existing ? 'updated' : 'created';
}

export interface ScanOutput {
  scanRunId: string;
  totalFetched: number;
  totalCreated: number;
  totalUpdated: number;
  totalStored: number;
  totalDuplicates: number;
  duplicateReasons: Record<string, number>;
  totalParsed: number;
  totalDropped: number;
  dropReasons: {
    nonJobSignal: number;
    weakSignal: number;
    supportWithoutAnalytics: number;
    postedWindow: number;
    location: number;
    classification: number;
  };
  topExclusionReasons: Array<{ reason: string; count: number }>;
  matchTypeCounts: {
    titleOnly: number;
    descriptionOnly: number;
    titleAndDescription: number;
  };
  roleFamilyHitTotals: Record<string, number>;
  failedSources: number;
  sourceStatuses: SourceStatusRow[];
  underperforming: boolean;
  underperformingReasons: string[];
  performanceTargets: {
    fetched: number;
    parsed: number;
    linkedinVisible: number;
  };
  performanceObserved: {
    fetched: number;
    parsed: number;
    linkedinVisible: number;
  };
  csvExport: {
    path: string;
    rowCount: number;
  } | null;
}

function buildTopExclusionReasons(dropReasons: ScanOutput['dropReasons']): Array<{ reason: string; count: number }> {
  return Object.entries(dropReasons)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

async function runScanWithoutDatabase(): Promise<ScanOutput> {
  const scanRunId = `demo-live-${Date.now()}`;
  const context: ProviderFetchContext = {
    keywords: mergedKeywordUniverse(),
    irelandOnly: true,
    maxPages: env.scanMaxPages,
    timeoutMs: env.scanTimeoutMs
  };

  const adapters = allAdapters().filter((adapter) => {
    return FORCED_SOURCES.has(adapter.source);
  });

  const results = await Promise.all(adapters.map((adapter) => executeAdapterFetch(adapter, context)));

  let totalFetched = 0;
  let totalDuplicates = 0;
  let failedSources = 0;
  let totalDroppedByNonJobSignal = 0;
  let totalDroppedByWeakSignal = 0;
  let totalDroppedBySupportWithoutAnalytics = 0;
  let totalDroppedByPostedWindow = 0;
  let totalDroppedByLocation = 0;
  let totalExcludedByClassification = 0;
  let totalTitleOnlyMatchCount = 0;
  let totalDescriptionOnlyMatchCount = 0;
  let totalTitleAndDescriptionMatchCount = 0;
  const roleFamilyHitTotals = emptyRoleFamilyHitCounts();

  const allScored: ScoredJob[] = [];
  const sourceStatuses: ScanOutput['sourceStatuses'] = [];

  for (const row of results) {
    const backfill = env.enableMockMode
      ? backfillProviderJobs(row.adapter, context.keywords, row.result.jobs, env.providerBackfillMinJobs)
      : { jobs: row.result.jobs, backfilled: 0 };
    const providerJobs = backfill.jobs;
    const fetched = providerJobs.length;
    totalFetched += fetched;

    const roleEvaluated = providerJobs.map((job) => ({
      job,
      gate: evaluateRoleGate(job.title, job.description)
    }));
    const afterRoleFilter = roleEvaluated.filter((row) => row.gate.eligible);
    const normalized = afterRoleFilter.map((row) => normalizeProviderJob(row.job));
    const afterPostedWindow = normalized.filter((job) => isWithinPostedWindow(job.postedAt));
    const afterLocationFilter = afterPostedWindow.filter((job) =>
      shouldKeepLocation(job.locationText, job.country, job.workMode)
    );

    const scored = afterLocationFilter.map((job) => ({
      ...job,
      score: scoreJob(job)
    }));
    allScored.push(...scored);

    const status = scanStatusFromResult(row.result.errors, fetched);
    if (status !== ScanStatus.SUCCESS) {
      failedSources += 1;
    }

    const droppedByNonJobSignal = roleEvaluated.filter((row) => row.gate.reason === 'non_job_signal').length;
    const droppedByWeakSignal = roleEvaluated.filter((row) => row.gate.reason === 'insufficient_cluster_signal').length;
    const droppedBySupportWithoutAnalytics = roleEvaluated.filter(
      (row) => row.gate.reason === 'support_without_analytics'
    ).length;
    const titleOnlyMatchCount = afterRoleFilter.filter((row) => row.gate.matchMode === 'title_only').length;
    const descriptionOnlyMatchCount = afterRoleFilter.filter((row) => row.gate.matchMode === 'description_only').length;
    const titleAndDescriptionMatchCount = afterRoleFilter.filter(
      (row) => row.gate.matchMode === 'title_and_description'
    ).length;
    const roleFamilyHitCounts = emptyRoleFamilyHitCounts();
    for (const rowEval of afterRoleFilter) {
      for (const [family, count] of Object.entries(rowEval.gate.roleFamilyHits)) {
        roleFamilyHitCounts[family] = (roleFamilyHitCounts[family] ?? 0) + count;
        roleFamilyHitTotals[family] = (roleFamilyHitTotals[family] ?? 0) + count;
      }
    }

    totalDroppedByNonJobSignal += droppedByNonJobSignal;
    totalDroppedByWeakSignal += droppedByWeakSignal;
    totalDroppedBySupportWithoutAnalytics += droppedBySupportWithoutAnalytics;
    totalDroppedByPostedWindow += Math.max(0, afterRoleFilter.length - afterPostedWindow.length);
    totalDroppedByLocation += Math.max(0, afterPostedWindow.length - afterLocationFilter.length);
    totalTitleOnlyMatchCount += titleOnlyMatchCount;
    totalDescriptionOnlyMatchCount += descriptionOnlyMatchCount;
    totalTitleAndDescriptionMatchCount += titleAndDescriptionMatchCount;

    sourceStatuses.push({
      source: row.adapter,
      status,
      fetched,
      parsed: afterLocationFilter.length,
      duplicates: 0,
      created: 0,
      updated: 0,
      errors: row.result.errors,
      pipeline: {
        afterRoleFilter: afterRoleFilter.length,
        afterPostedWindow: afterPostedWindow.length,
        afterLocationFilter: afterLocationFilter.length,
        droppedByRole: Math.max(0, fetched - afterRoleFilter.length),
        droppedByPostedWindow: Math.max(0, afterRoleFilter.length - afterPostedWindow.length),
        droppedByLocation: Math.max(0, afterPostedWindow.length - afterLocationFilter.length),
        droppedByNonJobSignal,
        droppedByWeakSignal,
        droppedBySupportWithoutAnalytics,
        titleOnlyMatchCount,
        descriptionOnlyMatchCount,
        titleAndDescriptionMatchCount,
        roleFamilyHitCounts,
        dropReasons: {
          nonJobSignal: droppedByNonJobSignal,
          weakSignal: droppedByWeakSignal,
          supportWithoutAnalytics: droppedBySupportWithoutAnalytics,
          postedWindow: Math.max(0, afterRoleFilter.length - afterPostedWindow.length),
          location: Math.max(0, afterPostedWindow.length - afterLocationFilter.length)
        }
      }
    });

    if (backfill.backfilled > 0) {
      logger.warn('scan provider coverage backfilled with mock jobs', {
        provider: row.adapter,
        backfilled: backfill.backfilled,
        liveJobs: row.result.jobs.length,
        resultingJobs: providerJobs.length
      });
    }
  }

  const dedupe = deduplicateJobs(allScored);
  totalDuplicates = dedupe.duplicates;

  for (const group of dedupe.groups) {
    if (group.canonical.score.classification === Classification.EXCLUDED) {
      totalExcludedByClassification += group.members.length;
      continue;
    }

    const state = sourceStatuses.find((x) => x.source === group.canonical.sourcePrimary);
    if (state) {
      state.duplicates += Math.max(0, group.members.length - 1);
      state.created += 1;
    }
  }

  if (totalFetched === 0 && env.enableMockMode) {
    logger.warn('runScanWithoutDatabase: no live jobs fetched, using mock fallback');
    const demo = runDemoScan();
    return {
      ...demo,
      sourceStatuses: demo.sourceStatuses.map((status) => ({
        ...status,
        created: 0,
        updated: 0,
        pipeline: {
          afterRoleFilter: status.parsed,
          afterPostedWindow: status.parsed,
          afterLocationFilter: status.parsed,
          droppedByRole: Math.max(0, status.fetched - status.parsed),
          droppedByPostedWindow: 0,
          droppedByLocation: 0,
          droppedByNonJobSignal: 0,
          droppedByWeakSignal: 0,
          droppedBySupportWithoutAnalytics: 0,
          titleOnlyMatchCount: 0,
          descriptionOnlyMatchCount: 0,
          titleAndDescriptionMatchCount: 0,
          roleFamilyHitCounts: emptyRoleFamilyHitCounts(),
          dropReasons: {
            nonJobSignal: 0,
            weakSignal: 0,
            supportWithoutAnalytics: 0,
            postedWindow: 0,
            location: 0
          }
        }
      })),
      totalParsed: demo.sourceStatuses.reduce((sum, status) => sum + status.parsed, 0),
      totalStored: demo.totalCreated + demo.totalUpdated,
      totalDropped: 0,
      duplicateReasons: {},
      dropReasons: {
        nonJobSignal: 0,
        weakSignal: 0,
        supportWithoutAnalytics: 0,
        postedWindow: 0,
        location: 0,
        classification: 0
      },
      topExclusionReasons: [],
      matchTypeCounts: {
        titleOnly: 0,
        descriptionOnly: 0,
        titleAndDescription: 0
      },
      roleFamilyHitTotals: emptyRoleFamilyHitCounts(),
      underperforming: false,
      underperformingReasons: [],
      performanceTargets: {
        fetched: env.dailyTargetFetched,
        parsed: env.dailyTargetParsed,
        linkedinVisible: env.dailyTargetLinkedinVisible
      },
      performanceObserved: {
        fetched: demo.totalFetched,
        parsed: demo.sourceStatuses.reduce((sum, status) => sum + status.parsed, 0),
        linkedinVisible: 0
      },
      csvExport: null
    };
  }

  const persisted = hydrateDemoFromScannedGroups({
    scanRunId,
    groups: dedupe.groups,
    totalFetched,
    totalDuplicates,
    failedSources,
    sourceStatuses
  });

  const totalParsed = sourceStatuses.reduce((sum, status) => sum + status.parsed, 0);
  const linkedinVisible = dedupe.groups.filter((group) => {
    if (group.canonical.score.classification === Classification.EXCLUDED) {
      return false;
    }

    const postedAt = group.canonical.postedAt;
    if (!postedAt) {
      return false;
    }

    return (
      group.canonical.sourcePrimary === SourceName.LINKEDIN &&
      postedAt >= startOfDay(subDays(new Date(), 7))
    );
  }).length;
  const underperformingReasons: string[] = [];
  if (totalFetched < env.dailyTargetFetched) {
    underperformingReasons.push(`Total fetched below target (${totalFetched}/${env.dailyTargetFetched})`);
  }
  if (totalParsed < env.dailyTargetParsed) {
    underperformingReasons.push(`Total parsed below target (${totalParsed}/${env.dailyTargetParsed})`);
  }
  if (linkedinVisible < env.dailyTargetLinkedinVisible) {
    underperformingReasons.push(
      `LinkedIn visible (7d) below target (${linkedinVisible}/${env.dailyTargetLinkedinVisible})`
    );
  }
  const underperforming = underperformingReasons.length > 0;
  if (underperforming) {
    logger.warn('scan underperforming against targets', {
      scanRunId,
      underperformingReasons,
      sourceStatuses
    });
  }

  const csvExport = env.csvExportEnabled
    ? await exportPriorityCsvFromGroups({
        scanRunId,
        groups: dedupe.groups
      })
    : null;

  const dropReasons = {
    nonJobSignal: totalDroppedByNonJobSignal,
    weakSignal: totalDroppedByWeakSignal,
    supportWithoutAnalytics: totalDroppedBySupportWithoutAnalytics,
    postedWindow: totalDroppedByPostedWindow,
    location: totalDroppedByLocation,
    classification: totalExcludedByClassification
  };

  return {
    scanRunId,
    totalFetched,
    totalCreated: persisted.totalCreated,
    totalUpdated: persisted.totalUpdated,
    totalStored: persisted.totalCreated + persisted.totalUpdated,
    totalDuplicates,
    duplicateReasons: dedupe.duplicateReasons,
    totalDropped:
      totalDroppedByNonJobSignal +
      totalDroppedByWeakSignal +
      totalDroppedBySupportWithoutAnalytics +
      totalDroppedByPostedWindow +
      totalDroppedByLocation +
      totalExcludedByClassification,
    dropReasons,
    topExclusionReasons: buildTopExclusionReasons(dropReasons),
    matchTypeCounts: {
      titleOnly: totalTitleOnlyMatchCount,
      descriptionOnly: totalDescriptionOnlyMatchCount,
      titleAndDescription: totalTitleAndDescriptionMatchCount
    },
    roleFamilyHitTotals,
    failedSources,
    sourceStatuses,
    totalParsed,
    underperforming,
    underperformingReasons,
    performanceTargets: {
      fetched: env.dailyTargetFetched,
      parsed: env.dailyTargetParsed,
      linkedinVisible: env.dailyTargetLinkedinVisible
    },
    performanceObserved: {
      fetched: totalFetched,
      parsed: totalParsed,
      linkedinVisible
    },
    csvExport
  };
}

export async function runScan(): Promise<ScanOutput> {
  try {
    const scanRun = await prisma.scanRun.create({
      data: {
        status: ScanStatus.RUNNING
      }
    });

    const sourceMap = await ensureSourceRecords();
    await loadSearchConfig();

    const keywords = mergedKeywordUniverse();
    const context: ProviderFetchContext = {
      keywords,
      irelandOnly: true,
      maxPages: env.scanMaxPages,
      timeoutMs: env.scanTimeoutMs
    };

    const adapters = allAdapters().filter((adapter) => {
      return FORCED_SOURCES.has(adapter.source);
    });

    const results = await Promise.all(adapters.map((adapter) => executeAdapterFetch(adapter, context)));

    let totalFetched = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDuplicates = 0;
    let failedSources = 0;
    let totalDroppedByNonJobSignal = 0;
    let totalDroppedByWeakSignal = 0;
    let totalDroppedBySupportWithoutAnalytics = 0;
    let totalDroppedByPostedWindow = 0;
    let totalDroppedByLocation = 0;
    let totalExcludedByClassification = 0;
    let totalTitleOnlyMatchCount = 0;
    let totalDescriptionOnlyMatchCount = 0;
    let totalTitleAndDescriptionMatchCount = 0;
    const roleFamilyHitTotals = emptyRoleFamilyHitCounts();

    const allScored: ScoredJob[] = [];
    const sourceStatuses: ScanOutput['sourceStatuses'] = [];
    const sourceResultIdBySource = new Map<SourceName, string>();

    for (const row of results) {
      const sourceId = sourceMap.get(row.adapter)?.id;
      if (!sourceId) {
        continue;
      }

      const backfill = env.enableMockMode
        ? backfillProviderJobs(row.adapter, context.keywords, row.result.jobs, env.providerBackfillMinJobs)
        : { jobs: row.result.jobs, backfilled: 0 };
      const providerJobs = backfill.jobs;
      const fetched = providerJobs.length;
      totalFetched += fetched;

      const roleEvaluated = providerJobs.map((job) => ({
        job,
        gate: evaluateRoleGate(job.title, job.description)
      }));
      const afterRoleFilter = roleEvaluated.filter((row) => row.gate.eligible);
      const normalized = afterRoleFilter.map((row) => normalizeProviderJob(row.job));
      const afterPostedWindow = normalized.filter((job) => isWithinPostedWindow(job.postedAt));
      const afterLocationFilter = afterPostedWindow.filter((job) =>
        shouldKeepLocation(job.locationText, job.country, job.workMode)
      );

      const scored = afterLocationFilter.map((job) => ({
        ...job,
        score: scoreJob(job)
      }));

      allScored.push(...scored);

      const status = scanStatusFromResult(row.result.errors, fetched);
      if (status !== ScanStatus.SUCCESS) {
        failedSources += 1;
      }

      const droppedByNonJobSignal = roleEvaluated.filter((row) => row.gate.reason === 'non_job_signal').length;
      const droppedByWeakSignal = roleEvaluated.filter((row) => row.gate.reason === 'insufficient_cluster_signal').length;
      const droppedBySupportWithoutAnalytics = roleEvaluated.filter(
        (row) => row.gate.reason === 'support_without_analytics'
      ).length;
      const titleOnlyMatchCount = afterRoleFilter.filter((row) => row.gate.matchMode === 'title_only').length;
      const descriptionOnlyMatchCount = afterRoleFilter.filter((row) => row.gate.matchMode === 'description_only').length;
      const titleAndDescriptionMatchCount = afterRoleFilter.filter(
        (row) => row.gate.matchMode === 'title_and_description'
      ).length;
      const roleFamilyHitCounts = emptyRoleFamilyHitCounts();
      for (const rowEval of afterRoleFilter) {
        for (const [family, count] of Object.entries(rowEval.gate.roleFamilyHits)) {
          roleFamilyHitCounts[family] = (roleFamilyHitCounts[family] ?? 0) + count;
          roleFamilyHitTotals[family] = (roleFamilyHitTotals[family] ?? 0) + count;
        }
      }

      totalDroppedByNonJobSignal += droppedByNonJobSignal;
      totalDroppedByWeakSignal += droppedByWeakSignal;
      totalDroppedBySupportWithoutAnalytics += droppedBySupportWithoutAnalytics;
      totalDroppedByPostedWindow += Math.max(0, afterRoleFilter.length - afterPostedWindow.length);
      totalDroppedByLocation += Math.max(0, afterPostedWindow.length - afterLocationFilter.length);
      totalTitleOnlyMatchCount += titleOnlyMatchCount;
      totalDescriptionOnlyMatchCount += descriptionOnlyMatchCount;
      totalTitleAndDescriptionMatchCount += titleAndDescriptionMatchCount;

      await prisma.source.update({
        where: { id: sourceId },
        data: {
          enabled: providerMode(row.adapter) !== 'off',
          mockMode: providerMode(row.adapter) === 'mock',
          health: mapProviderHealth(row.result.health.status),
          lastScanAttemptAt: new Date(),
          lastSuccessfulScan: status === ScanStatus.SUCCESS ? new Date() : undefined,
          lastError: row.result.errors[0] ?? null
        }
      });

      const sourceResult = await prisma.scanRunSourceResult.create({
        data: {
          scanRunId: scanRun.id,
          sourceId,
          status,
          durationMs: row.duration,
          fetchedCount: fetched,
          parsedCount: afterLocationFilter.length,
          skippedCount: Math.max(0, fetched - afterLocationFilter.length),
          duplicateCount: 0,
          errorCount: row.result.errors.length,
          errorMessage: row.result.errors.join(' | ') || null,
          detailsJson: {
            warnings: row.result.warnings,
            backfilledMockCount: backfill.backfilled,
            pipeline: {
              afterRoleFilter: afterRoleFilter.length,
              afterPostedWindow: afterPostedWindow.length,
              afterLocationFilter: afterLocationFilter.length,
              droppedByRole: Math.max(0, fetched - afterRoleFilter.length),
              droppedByPostedWindow: Math.max(0, afterRoleFilter.length - afterPostedWindow.length),
              droppedByLocation: Math.max(0, afterPostedWindow.length - afterLocationFilter.length),
              droppedByNonJobSignal,
              droppedByWeakSignal,
              droppedBySupportWithoutAnalytics,
              titleOnlyMatchCount,
              descriptionOnlyMatchCount,
              titleAndDescriptionMatchCount,
              roleFamilyHitCounts,
              dropReasons: {
                nonJobSignal: droppedByNonJobSignal,
                weakSignal: droppedByWeakSignal,
                supportWithoutAnalytics: droppedBySupportWithoutAnalytics,
                postedWindow: Math.max(0, afterRoleFilter.length - afterPostedWindow.length),
                location: Math.max(0, afterPostedWindow.length - afterLocationFilter.length)
              }
            },
            health: {
              provider: row.result.health.provider,
              status: row.result.health.status,
              message: row.result.health.message ?? null,
              lastSuccessAt: row.result.health.lastSuccessAt?.toISOString() ?? null
            }
          } as Prisma.InputJsonValue
        }
      });
      sourceResultIdBySource.set(row.adapter, sourceResult.id);

      sourceStatuses.push({
        source: row.adapter,
        status,
        fetched,
        parsed: afterLocationFilter.length,
        duplicates: 0,
        created: 0,
        updated: 0,
        errors: row.result.errors,
        pipeline: {
          afterRoleFilter: afterRoleFilter.length,
          afterPostedWindow: afterPostedWindow.length,
          afterLocationFilter: afterLocationFilter.length,
          droppedByRole: Math.max(0, fetched - afterRoleFilter.length),
          droppedByPostedWindow: Math.max(0, afterRoleFilter.length - afterPostedWindow.length),
          droppedByLocation: Math.max(0, afterPostedWindow.length - afterLocationFilter.length),
          droppedByNonJobSignal,
          droppedByWeakSignal,
          droppedBySupportWithoutAnalytics,
          titleOnlyMatchCount,
          descriptionOnlyMatchCount,
          titleAndDescriptionMatchCount,
          roleFamilyHitCounts,
          dropReasons: {
            nonJobSignal: droppedByNonJobSignal,
            weakSignal: droppedByWeakSignal,
            supportWithoutAnalytics: droppedBySupportWithoutAnalytics,
            postedWindow: Math.max(0, afterRoleFilter.length - afterPostedWindow.length),
            location: Math.max(0, afterPostedWindow.length - afterLocationFilter.length)
          }
        }
      });

      if (backfill.backfilled > 0) {
        logger.warn('scan provider coverage backfilled with mock jobs', {
          provider: row.adapter,
          backfilled: backfill.backfilled,
          liveJobs: row.result.jobs.length,
          resultingJobs: providerJobs.length
        });
      }
    }

    const dedupe = deduplicateJobs(allScored);
    totalDuplicates = dedupe.duplicates;

    for (const group of dedupe.groups) {
      if (group.canonical.score.classification === Classification.EXCLUDED) {
        totalExcludedByClassification += group.members.length;
        continue;
      }

      const outcome = await upsertJobGroup(group, sourceMap);
      if (outcome === 'created') {
        totalCreated += 1;
      } else {
        totalUpdated += 1;
      }

      const state = sourceStatuses.find((x) => x.source === group.canonical.sourcePrimary);
      if (state) {
        state.duplicates += Math.max(0, group.members.length - 1);
        if (outcome === 'created') {
          state.created += 1;
        } else {
          state.updated += 1;
        }
      }
    }

    await Promise.all(
      sourceStatuses.map(async (status) => {
        const sourceResultId = sourceResultIdBySource.get(status.source);
        if (!sourceResultId) {
          return;
        }

        await prisma.scanRunSourceResult.update({
          where: { id: sourceResultId },
          data: {
            duplicateCount: status.duplicates
          }
        });
      })
    );

    const totalParsed = sourceStatuses.reduce((sum, status) => sum + status.parsed, 0);
    const linkedinVisible = await getLinkedInVisibleCountFromDatabase();
    const underperformingReasons: string[] = [];
    if (totalFetched < env.dailyTargetFetched) {
      underperformingReasons.push(`Total fetched below target (${totalFetched}/${env.dailyTargetFetched})`);
    }
    if (totalParsed < env.dailyTargetParsed) {
      underperformingReasons.push(`Total parsed below target (${totalParsed}/${env.dailyTargetParsed})`);
    }
    if (linkedinVisible < env.dailyTargetLinkedinVisible) {
      underperformingReasons.push(
        `LinkedIn visible (7d) below target (${linkedinVisible}/${env.dailyTargetLinkedinVisible})`
      );
    }
    const underperforming = underperformingReasons.length > 0;
    if (underperforming) {
      logger.warn('scan underperforming against targets', {
        scanRunId: scanRun.id,
        underperformingReasons,
        sourceStatuses
      });
    }

    const csvExport = env.csvExportEnabled ? await exportPriorityCsvFromDatabase({ scanRunId: scanRun.id }) : null;

    await prisma.scanRun.update({
      where: { id: scanRun.id },
      data: {
        completedAt: new Date(),
        status: failedSources > 0 ? ScanStatus.PARTIAL_FAILURE : ScanStatus.SUCCESS,
        totalFetched,
        totalCreated,
        totalUpdated,
        totalDuplicates,
        totalFailedSources: failedSources
      }
    });

    logger.info('scan completed', {
      scanRunId: scanRun.id,
      totalFetched,
      totalCreated,
      totalUpdated,
      totalDuplicates,
      failedSources
    });

    const dropReasons = {
      nonJobSignal: totalDroppedByNonJobSignal,
      weakSignal: totalDroppedByWeakSignal,
      supportWithoutAnalytics: totalDroppedBySupportWithoutAnalytics,
      postedWindow: totalDroppedByPostedWindow,
      location: totalDroppedByLocation,
      classification: totalExcludedByClassification
    };

    return {
      scanRunId: scanRun.id,
      totalFetched,
      totalCreated,
      totalUpdated,
      totalStored: totalCreated + totalUpdated,
      totalDuplicates,
      duplicateReasons: dedupe.duplicateReasons,
      totalDropped:
        totalDroppedByNonJobSignal +
        totalDroppedByWeakSignal +
        totalDroppedBySupportWithoutAnalytics +
        totalDroppedByPostedWindow +
        totalDroppedByLocation +
        totalExcludedByClassification,
      dropReasons,
      topExclusionReasons: buildTopExclusionReasons(dropReasons),
      matchTypeCounts: {
        titleOnly: totalTitleOnlyMatchCount,
        descriptionOnly: totalDescriptionOnlyMatchCount,
        titleAndDescription: totalTitleAndDescriptionMatchCount
      },
      roleFamilyHitTotals,
      failedSources,
      sourceStatuses,
      totalParsed,
      underperforming,
      underperformingReasons,
      performanceTargets: {
        fetched: env.dailyTargetFetched,
        parsed: env.dailyTargetParsed,
        linkedinVisible: env.dailyTargetLinkedinVisible
      },
      performanceObserved: {
        fetched: totalFetched,
        parsed: totalParsed,
        linkedinVisible
      },
      csvExport
    };
  } catch (error) {
    logger.warn('runScan fallback to no-db live scan', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return runScanWithoutDatabase();
  }
}

export async function getLatestScanSummary() {
  try {
    return await prisma.scanRun.findFirst({
      orderBy: { startedAt: 'desc' },
      include: {
        sourceResults: {
          include: {
            source: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  } catch (error) {
    logger.warn('getLatestScanSummary fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return getDemoLatestScanSummary();
  }
}
