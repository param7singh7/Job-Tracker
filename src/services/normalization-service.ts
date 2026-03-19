import { EmploymentType, SeniorityLevel, SourceName, WorkMode } from '@prisma/client';
import { normalizeIrishLocation } from '@/src/config/locations';
import { parsePostedAt } from '@/src/lib/dates';
import { compactText, hashableKey, normalizeText } from '@/src/lib/text';
import { matchKeywords } from '@/src/services/keyword-matcher';
import { NormalizedJobDraft, RawProviderJob } from '@/src/types/job';

function mapWorkMode(value?: string, fallbackCountry?: string): WorkMode {
  const normalized = normalizeText(value);

  if (normalized.includes('remote')) {
    return WorkMode.REMOTE;
  }

  if (normalized.includes('hybrid')) {
    return WorkMode.HYBRID;
  }

  if (normalized.includes('on site') || normalized.includes('onsite')) {
    return WorkMode.ONSITE;
  }

  if (fallbackCountry?.toLowerCase() === 'ireland') {
    return WorkMode.ONSITE;
  }

  return WorkMode.UNKNOWN;
}

function mapEmploymentType(value?: string): EmploymentType {
  const normalized = normalizeText(value);

  if (normalized.includes('full')) {
    return EmploymentType.FULL_TIME;
  }

  if (normalized.includes('part')) {
    return EmploymentType.PART_TIME;
  }

  if (normalized.includes('contract') || normalized.includes('temporary')) {
    return EmploymentType.CONTRACT;
  }

  if (normalized.includes('intern')) {
    return EmploymentType.INTERNSHIP;
  }

  if (normalized.includes('graduate')) {
    return EmploymentType.GRADUATE;
  }

  return EmploymentType.UNKNOWN;
}

function mapSeniority(title: string, description?: string): SeniorityLevel {
  const blob = normalizeText(`${title} ${description ?? ''}`);

  if (blob.includes('director') || blob.includes('head of')) {
    return SeniorityLevel.DIRECTOR;
  }

  if (blob.includes('manager')) {
    return SeniorityLevel.MANAGER;
  }

  if (blob.includes('lead') || blob.includes('principal')) {
    return SeniorityLevel.LEAD;
  }

  if (blob.includes('senior')) {
    return SeniorityLevel.SENIOR;
  }

  if (blob.includes('junior') || blob.includes('entry') || blob.includes('graduate')) {
    return SeniorityLevel.JUNIOR;
  }

  if (blob.includes('associate')) {
    return SeniorityLevel.ASSOCIATE;
  }

  if (blob.includes('analyst')) {
    return SeniorityLevel.MID;
  }

  return SeniorityLevel.UNKNOWN;
}

function parseSalary(salaryText?: string): { min?: number; max?: number; currency?: string } {
  if (!salaryText) {
    return {};
  }

  const normalized = salaryText.replace(/,/g, '');
  const amounts = Array.from(normalized.matchAll(/(\d{2,6})/g)).map((x) => Number(x[1]));

  const currency = normalized.includes('€') || normalized.toLowerCase().includes('eur') ? 'EUR' : undefined;

  if (!amounts.length) {
    return { currency };
  }

  return {
    min: amounts[0],
    max: amounts.length > 1 ? amounts[1] : undefined,
    currency
  };
}

export function normalizeProviderJob(raw: RawProviderJob): NormalizedJobDraft {
  const titleNormalized = normalizeText(raw.title);
  const companyNameNormalized = normalizeText(raw.company || 'Unknown');
  const descriptionClean = compactText(raw.description);
  const postedAt = parsePostedAt(raw.postedText, raw.postedAt);
  const location = normalizeIrishLocation(raw.locationText);
  const matched = matchKeywords(raw.title, raw.description);
  const salary = parseSalary(raw.salaryText);
  const workMode = mapWorkMode(
    `${raw.workModeText ?? ''} ${raw.locationText ?? ''} ${raw.title ?? ''} ${raw.description ?? ''}`,
    location.country
  );
  const employmentType = mapEmploymentType(raw.employmentTypeText ?? raw.description);
  const seniorityLevel = mapSeniority(raw.title, raw.description);

  const canonicalKey = hashableKey([
    raw.provider,
    raw.providerJobId,
    raw.sourceUrl ?? raw.applyUrl,
    titleNormalized,
    companyNameNormalized
  ]);

  const duplicateGroupId = hashableKey([
    titleNormalized,
    companyNameNormalized,
    location.city ?? location.country ?? 'ireland'
  ]);

  const blob = normalizeText(`${raw.title} ${raw.description ?? ''}`);
  const roleFamilyKeywords = Object.entries(matched.roleFamilyHits)
    .filter(([, hits]) => hits > 0)
    .map(([family]) => `cluster:${normalizeText(family)}`);

  return {
    sourcePrimary: raw.provider,
    sourceJobId: raw.providerJobId,
    sourceUrl: raw.sourceUrl,
    applyUrl: raw.applyUrl,
    title: raw.title,
    titleNormalized,
    companyName: raw.company || 'Unknown',
    companyNameNormalized,
    locationText: raw.locationText,
    city: location.city,
    county: location.county,
    country: location.country,
    workMode,
    employmentType,
    seniorityLevel,
    descriptionRaw: raw.description,
    descriptionClean,
    postedAt,
    discoveredAt: new Date(),
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    sponsorshipMentioned: blob.includes('sponsor') || blob.includes('visa'),
    workAuthorizationMentioned: blob.includes('work authorization') || blob.includes('right to work'),
    extractedSkills: [...new Set([...matched.extractedSkills, ...matched.toolMatches])],
    matchedKeywords: [
      ...new Set([
        ...matched.titleMatches,
        ...matched.descriptionMatches,
        ...matched.toolMatches,
        ...matched.responsibilityMatches,
        ...roleFamilyKeywords
      ])
    ],
    excludedKeywords: matched.excludedMatches,
    scanConfidence: 0.7,
    canonicalKey,
    duplicateGroupId
  };
}

export function isSourceName(value: string): value is SourceName {
  return Object.values(SourceName).includes(value as SourceName);
}
