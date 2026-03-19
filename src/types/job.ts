import { Classification, MatchLevel, SourceName, WorkMode, EmploymentType, SeniorityLevel } from '@prisma/client';

export type ProviderMode = 'live' | 'mock' | 'off';

export interface ProviderHealthSnapshot {
  provider: SourceName;
  status: 'healthy' | 'degraded' | 'down' | 'disabled';
  message?: string;
  lastSuccessAt?: Date;
}

export interface RawProviderJob {
  provider: SourceName;
  providerJobId: string;
  sourceUrl?: string;
  applyUrl?: string;
  title: string;
  company: string;
  locationText?: string;
  postedText?: string;
  postedAt?: Date;
  description?: string;
  employmentTypeText?: string;
  workModeText?: string;
  salaryText?: string;
  rawPayload?: Record<string, unknown>;
}

export interface NormalizedJobDraft {
  sourcePrimary: SourceName;
  sourceJobId: string;
  sourceUrl?: string;
  applyUrl?: string;
  title: string;
  titleNormalized: string;
  companyName: string;
  companyNameNormalized: string;
  locationText?: string;
  city?: string;
  county?: string;
  country?: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  seniorityLevel: SeniorityLevel;
  descriptionRaw?: string;
  descriptionClean?: string;
  postedAt?: Date;
  discoveredAt: Date;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  sponsorshipMentioned: boolean;
  workAuthorizationMentioned: boolean;
  extractedSkills: string[];
  matchedKeywords: string[];
  excludedKeywords: string[];
  scanConfidence: number;
  canonicalKey: string;
  duplicateGroupId: string;
}

export interface ScoreBreakdown {
  title_match_score: number;
  skills_match_score: number;
  recency_score: number;
  seniority_fit_score: number;
  eligibility_score: number;
  urgency_score: number;
  relevance_score: number;
  final_score: number;
  match_level: MatchLevel;
  classification: Classification;
  reasons: string[];
  classificationReason: string;
}

export interface ScoredJob extends NormalizedJobDraft {
  score: ScoreBreakdown;
}

export interface ProviderFetchContext {
  keywords: string[];
  irelandOnly: boolean;
  maxPages: number;
  timeoutMs: number;
}

export interface ProviderFetchResult {
  provider: SourceName;
  jobs: RawProviderJob[];
  errors: string[];
  warnings: string[];
  health: ProviderHealthSnapshot;
  durationMs: number;
}

export interface SourceScanSummary {
  provider: SourceName;
  fetched: number;
  parsed: number;
  skipped: number;
  duplicates: number;
  errors: string[];
  status: 'success' | 'partial_failure' | 'failed';
  durationMs: number;
}
