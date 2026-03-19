import { Classification, MatchLevel, SeniorityLevel } from '@prisma/client';
import {
  DESCRIPTION_SIGNAL_KEYWORDS,
  DOMAIN_PRIORITY_KEYWORDS,
  ROLE_FAMILY_CLUSTERS,
  SUPPORT_ANALYTICS_BRIDGE_KEYWORDS,
  SUPPORT_EXCLUDE_KEYWORDS,
  STRETCH_ROLE_KEYWORDS,
  TOOL_KEYWORDS
} from '@/src/config/keywords';
import { isRecruitmentOrConsultancyCompany } from '@/src/lib/company-filter';
import { ageInHours } from '@/src/lib/dates';
import { includesAny, normalizeText } from '@/src/lib/text';
import { ScoreBreakdown, NormalizedJobDraft } from '@/src/types/job';

const HIGH_INTENT_TITLE_PATTERNS = [
  'data analyst',
  'business data analyst',
  'reporting analyst',
  'insights analyst',
  'data and insights analyst',
  'bi analyst',
  'business intelligence analyst',
  'power bi analyst',
  'bi developer',
  'power bi developer',
  'reporting developer',
  'tableau analyst',
  'sql analyst',
  'analytics consultant',
  'reporting consultant',
  'functional consultant',
  'business analyst',
  'process analyst',
  'business process analyst',
  'decision support analyst',
  'compliance analyst',
  'quality reporting analyst',
  'healthcare data analyst',
  'medtech analyst',
  'fraud analyst',
  'risk analyst',
  'sql developer'
] as const;

const HARD_EXCLUDE_PATTERNS = [
  'machine learning engineer',
  'ml engineer',
  'machine learning platform',
  'research scientist',
  'deep learning',
  'nlp',
  'advanced data scientist',
  'platform engineer',
  'software engineer',
  'devops',
  'site reliability engineer',
  'site reliability',
  'sre',
  'cloud architect',
  'mlops'
] as const;

const DOWNRANK_PATTERNS = [
  ...SUPPORT_EXCLUDE_KEYWORDS,
  'cloud admin',
  'infrastructure engineer',
  'data scientist',
  'data engineer',
  'architect',
  'head of',
  'director',
  'principal',
  'lead'
] as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function recencyScore(postedAt?: Date): number {
  const hours = ageInHours(postedAt);

  if (hours <= 12) {
    return 100;
  }

  if (hours <= 24) {
    return 94;
  }

  if (hours <= 72) {
    return 82;
  }

  if (hours <= 168) {
    return 70;
  }

  if (hours <= 336) {
    return 55;
  }

  if (hours <= 720) {
    return 35;
  }

  return 15;
}

function seniorityFit(level: SeniorityLevel): number {
  switch (level) {
    case SeniorityLevel.ENTRY:
    case SeniorityLevel.JUNIOR:
      return 95;
    case SeniorityLevel.ASSOCIATE:
      return 88;
    case SeniorityLevel.MID:
      return 82;
    case SeniorityLevel.SENIOR:
      return 45;
    case SeniorityLevel.LEAD:
      return 28;
    case SeniorityLevel.MANAGER:
      return 20;
    case SeniorityLevel.DIRECTOR:
      return 6;
    default:
      return 65;
  }
}

function titleScore(title: string): { score: number; reasons: string[] } {
  const normalized = normalizeText(title);
  const matches = HIGH_INTENT_TITLE_PATTERNS.filter((pattern) => normalized.includes(pattern));
  const stretchByTitle =
    STRETCH_ROLE_KEYWORDS.some((pattern) => normalized.includes(normalizeText(pattern))) ||
    normalized.includes('business intelligence developer') ||
    normalized.includes('analytics engineer') ||
    normalized.includes('decision scientist') ||
    normalized.includes('product data scientist') ||
    normalized.includes('junior data engineer');
  const hardExcludes = HARD_EXCLUDE_PATTERNS.filter((pattern) => normalized.includes(pattern));
  const downranks = DOWNRANK_PATTERNS.filter((pattern) => normalized.includes(pattern)).filter((pattern) => {
    if (!stretchByTitle) {
      return true;
    }

    return pattern !== 'data engineer' && pattern !== 'data scientist' && pattern !== 'lead' && pattern !== 'principal';
  });

  const reasons: string[] = [];
  if (matches.length) {
    reasons.push(`Title aligned with analytics role (${matches.join(', ')})`);
  }

  if (hardExcludes.length) {
    reasons.push(`Title includes hard non-target engineering pattern (${hardExcludes.join(', ')})`);
  }

  if (downranks.length) {
    reasons.push(`Title includes down-rank pattern (${downranks.join(', ')})`);
  }

  const hasGeneralSignal =
    normalized.includes('analyst') ||
    normalized.includes('analytics') ||
    normalized.includes('reporting') ||
    normalized.includes('insight') ||
    normalized.includes('consultant') ||
    normalized.includes('business intelligence') ||
    normalized.includes('sql');
  let score = matches.length ? 62 + matches.length * 9 : hasGeneralSignal ? 50 : 28;
  if (hardExcludes.length) {
    score -= 55;
  }
  if (downranks.length) {
    score -= Math.min(26, 7 * downranks.length);
  }

  return {
    score: clampScore(score),
    reasons
  };
}

function skillsScore(skills: string[]): { score: number; reasons: string[] } {
  if (!skills.length) {
    return {
      score: 30,
      reasons: ['Low explicit skill coverage']
    };
  }

  const highSignal = skills.filter((s) =>
    ['sql', 'power bi', 'power query', 'dax', 'tableau', 'dashboard', 'reporting', 'kpi', 'metrics'].includes(s)
  );
  const score = clampScore(34 + skills.length * 6 + highSignal.length * 6);

  return {
    score,
    reasons: [`Detected skills: ${skills.join(', ')}`]
  };
}

function descriptionSignalScore(job: NormalizedJobDraft): { score: number; reasons: string[] } {
  const description = normalizeText(job.descriptionClean ?? job.descriptionRaw ?? '');
  const matchedKeywords = job.matchedKeywords.map((value) => normalizeText(value));
  const descriptionSignals = includesAny(description, DESCRIPTION_SIGNAL_KEYWORDS);
  const toolSignals = includesAny(description, TOOL_KEYWORDS);
  const domainSignals = includesAny(description, DOMAIN_PRIORITY_KEYWORDS);
  const supportBridgeSignals = includesAny(description, SUPPORT_ANALYTICS_BRIDGE_KEYWORDS);
  const familySignals = Object.entries(ROLE_FAMILY_CLUSTERS).reduce(
    (acc, [family, terms]) => {
      const hits = includesAny(description, terms).length;
      if (hits > 0) {
        acc[family] = hits;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  if (!descriptionSignals.length && !matchedKeywords.length && !toolSignals.length) {
    return {
      score: 24,
      reasons: ['Low explicit description signal density']
    };
  }

  const familyStrength = Object.values(familySignals).reduce((sum, value) => sum + value, 0);
  const score = clampScore(
    26 +
      Math.min(22, descriptionSignals.length * 2.1) +
      Math.min(18, matchedKeywords.length * 1.9) +
      Math.min(18, toolSignals.length * 2.5) +
      Math.min(20, familyStrength * 2) +
      Math.min(12, domainSignals.length * 3) +
      Math.min(8, supportBridgeSignals.length * 2)
  );

  const dominantFamilies = Object.entries(familySignals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([family]) => family.replaceAll('_', ' '));

  const reasons: string[] = [];
  reasons.push(
    `Description signals matched (${Math.max(descriptionSignals.length, matchedKeywords.length)} keywords, ${toolSignals.length} tools)`
  );
  if (domainSignals.length) {
    reasons.push(`Priority domain overlap: ${domainSignals.slice(0, 3).join(', ')}`);
  }
  if (dominantFamilies.length) {
    reasons.push(`Role family clusters: ${dominantFamilies.join(', ')}`);
  }

  return {
    score,
    reasons
  };
}

function eligibilityScore(job: NormalizedJobDraft): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 72;

  if (job.country?.toLowerCase() === 'ireland') {
    score += 16;
    reasons.push('Ireland location confirmed');
  } else {
    score -= 20;
    reasons.push('Location not clearly in Ireland');
  }

  if (job.sponsorshipMentioned || job.workAuthorizationMentioned) {
    reasons.push('Work authorization language present');
  }

  const normalizedTitle = normalizeText(job.title);
  const normalizedDescription = normalizeText(job.descriptionClean ?? job.descriptionRaw ?? '');
  const blob = `${normalizedTitle} ${normalizedDescription}`;
  const titleLevelExcludes = job.excludedKeywords.filter((keyword) => normalizedTitle.includes(normalizeText(keyword))).slice(0, 3);
  const supportSignals = includesAny(blob, SUPPORT_EXCLUDE_KEYWORDS);
  const supportBridgeSignals = includesAny(blob, SUPPORT_ANALYTICS_BRIDGE_KEYWORDS);

  if (titleLevelExcludes.length) {
    score -= Math.min(20, 7 * titleLevelExcludes.length);
    reasons.push(`Title contains down-rank signals (${titleLevelExcludes.join(', ')})`);
  }

  if (supportSignals.length && supportBridgeSignals.length < 2) {
    score -= 18;
    reasons.push('Support-first role detected without enough analytics/reporting crossover');
  }

  return {
    score: clampScore(score),
    reasons
  };
}

function urgencyScore(recency: number, matchLikely: number): number {
  return clampScore(recency * 0.72 + matchLikely * 0.28);
}

export function scoreJob(job: NormalizedJobDraft): ScoreBreakdown {
  const normalizedTitle = normalizeText(job.title);
  const normalizedDescription = normalizeText(job.descriptionClean ?? job.descriptionRaw ?? '');
  const blob = `${normalizedTitle} ${normalizedDescription}`;
  const stretchByTitle =
    STRETCH_ROLE_KEYWORDS.some((pattern) => normalizedTitle.includes(normalizeText(pattern))) ||
    normalizedTitle.includes('business intelligence developer') ||
    normalizedTitle.includes('analytics engineer') ||
    normalizedTitle.includes('decision scientist') ||
    normalizedTitle.includes('product data scientist') ||
    normalizedTitle.includes('junior data engineer');
  const title = titleScore(job.title);
  const skills = skillsScore(job.extractedSkills);
  const description = descriptionSignalScore(job);
  const recency = recencyScore(job.postedAt);
  const seniority = seniorityFit(job.seniorityLevel);
  const eligibility = eligibilityScore(job);
  const urgency = urgencyScore(recency, Math.max(title.score, description.score));
  const recruitmentCompany = isRecruitmentOrConsultancyCompany(job.companyName);
  const supportSignals = includesAny(blob, SUPPORT_EXCLUDE_KEYWORDS);
  const supportBridgeSignals = includesAny(blob, SUPPORT_ANALYTICS_BRIDGE_KEYWORDS);
  const supportWithoutAnalytics = supportSignals.length > 0 && supportBridgeSignals.length < 2;
  const hasPriorityDomain = includesAny(blob, DOMAIN_PRIORITY_KEYWORDS).length > 0;

  const weighted =
    title.score * 0.2 +
    skills.score * 0.2 +
    description.score * 0.23 +
    recency * 0.16 +
    seniority * 0.1 +
    eligibility.score * 0.11;

  let final = clampScore(weighted * 0.88 + urgency * 0.12);
  const titleHasHardExclude = HARD_EXCLUDE_PATTERNS.some((pattern) => normalizedTitle.includes(pattern));
  if (titleHasHardExclude && !stretchByTitle) {
    final = clampScore(final - 22);
  }
  if (recruitmentCompany) {
    final = clampScore(final - 14);
  }
  if (supportWithoutAnalytics) {
    final = clampScore(final - 28);
  }
  if (hasPriorityDomain) {
    final = clampScore(final + 6);
  }

  let classification =
    final < 15 || (titleHasHardExclude && !stretchByTitle) || (supportWithoutAnalytics && final < 38)
      ? Classification.EXCLUDED
      : Classification.RELEVANT;

  if (stretchByTitle) {
    final = Math.min(Math.max(final, 46), 57);
    classification = Classification.RELEVANT;
  }

  let matchLevel: MatchLevel;
  if (classification === Classification.EXCLUDED) {
    matchLevel = MatchLevel.EXCLUDE;
  } else if (final >= 80) {
    matchLevel = MatchLevel.APPLY_NOW;
  } else if (final >= 68) {
    matchLevel = MatchLevel.STRONG_MATCH;
  } else if (final >= 54) {
    matchLevel = MatchLevel.GOOD_MATCH;
  } else if (final >= 40) {
    matchLevel = MatchLevel.STRETCH;
  } else {
    matchLevel = MatchLevel.LOW_MATCH;
  }

  if (stretchByTitle && classification !== Classification.EXCLUDED) {
    matchLevel = MatchLevel.STRETCH;
  }

  const reasons = [...title.reasons, ...skills.reasons, ...description.reasons, ...eligibility.reasons];
  if (recruitmentCompany) {
    reasons.push('Recruitment/consultancy company detected; down-ranked but kept visible');
  }
  if (supportWithoutAnalytics) {
    reasons.push('Support-first role without clear analytics/reporting scope; strongly down-ranked');
  }
  if (hasPriorityDomain) {
    reasons.push('Priority domain fit detected (consulting/healthcare/risk/compliance)');
  }
  if (
    classification !== Classification.EXCLUDED &&
    (job.seniorityLevel === SeniorityLevel.SENIOR ||
      job.seniorityLevel === SeniorityLevel.LEAD ||
      job.seniorityLevel === SeniorityLevel.MANAGER ||
      job.seniorityLevel === SeniorityLevel.DIRECTOR) &&
    matchLevel !== MatchLevel.LOW_MATCH
  ) {
    matchLevel = MatchLevel.STRETCH;
    reasons.push('Seniority level is above primary target range; shown as stretch');
  }
  if (stretchByTitle) {
    reasons.push('Eligible stretch role kept visible by design');
  }

  const classificationReason =
    classification === Classification.EXCLUDED
      ? supportWithoutAnalytics
        ? 'Role is primarily IT/support without enough analytics/reporting scope.'
        : 'Role has strong exclusion signals or insufficient overall fit.'
      : stretchByTitle
        ? 'Role is stretch but eligible for application based on analytics overlap.'
        : 'Role appears relevant for analytics-focused job hunt in Ireland.';

  return {
    title_match_score: title.score,
    skills_match_score: skills.score,
    recency_score: recency,
    seniority_fit_score: seniority,
    eligibility_score: eligibility.score,
    urgency_score: urgency,
    relevance_score: clampScore((title.score + skills.score + description.score + eligibility.score) / 4),
    final_score: final,
    match_level: matchLevel,
    classification,
    reasons,
    classificationReason
  };
}
