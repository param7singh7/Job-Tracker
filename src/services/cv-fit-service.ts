import { CV_PROFILE } from '@/src/config/cv-profile';
import { STRETCH_ROLE_KEYWORDS, SUPPORT_EXCLUDE_KEYWORDS } from '@/src/config/keywords';
import { includesAny, normalizeText } from '@/src/lib/text';

export type CvFitLabel = 'CV_MATCH' | 'GOOD_MATCH' | 'LESS_MATCH' | 'LOW_MATCH' | 'EXCLUDE';

export interface CvFitInput {
  title: string;
  description?: string | null;
  extractedSkills?: string[] | null;
  seniorityLevel?: string | null;
}

export interface CvFitResult {
  label: CvFitLabel;
  score: number;
  reasons: string[];
  matchedSkills: string[];
  matchedRoleTracks: string[];
}

const ROLE_TRACKS = [
  {
    label: 'Data Analytics Core',
    keywords: [
      'data analyst',
      'business data analyst',
      'insights analyst',
      'data and insights analyst',
      'decision support analyst',
      'data quality analyst'
    ]
  },
  {
    label: 'BI Reporting',
    keywords: [
      'reporting analyst',
      'business intelligence analyst',
      'bi analyst',
      'power bi analyst',
      'dashboard analyst',
      'reporting developer',
      'bi developer',
      'power bi developer',
      'sql reporting analyst'
    ]
  },
  {
    label: 'Consulting & BA Analytics',
    keywords: [
      'analytics consultant',
      'reporting consultant',
      'functional consultant',
      'business analyst',
      'process analyst',
      'business process analyst',
      'transformation analyst',
      'requirements gathering',
      'stakeholder management'
    ]
  },
  {
    label: 'Healthcare & Regulated',
    keywords: [
      'healthcare',
      'medtech',
      'medical device',
      'regulated',
      'compliance',
      'quality reporting',
      'risk',
      'fraud',
      'due diligence',
      'claims',
      'insurance'
    ]
  },
  {
    label: 'Light Data Engineering',
    keywords: [
      'sql developer',
      'reporting developer',
      'bi developer',
      'data warehouse',
      'etl',
      'reporting pipeline',
      'semantic model'
    ]
  }
] as const;

const HEAVY_MISMATCH = [
  ...SUPPORT_EXCLUDE_KEYWORDS,
  'machine learning engineer',
  'ml engineer',
  'research scientist',
  'platform engineer',
  'software engineer',
  'devops',
  'site reliability',
  'sre',
  'architect',
  'deep learning',
  'nlp'
] as const;

const HEAVY_DATA_ENGINEERING = [
  'spark',
  'kafka',
  'airflow',
  'terraform',
  'kubernetes',
  'distributed systems',
  'platform ownership',
  'production infrastructure',
  'scala'
] as const;

const STRONG_TOOL_SIGNALS = [
  'sql',
  'power bi',
  'dax',
  'power query',
  'excel',
  'tableau',
  'dashboard',
  'reporting',
  'kpi',
  'metrics',
  'stakeholder reporting',
  'data validation',
  'data quality'
] as const;

const TITLE_TOOL_SIGNALS = ['sql', 'power bi', 'tableau', 'dashboard', 'reporting', 'insights', 'kpi', 'metrics'] as const;

const HIGH_CONFIDENCE_TITLE_PATTERNS = [
  'data analyst',
  'business data analyst',
  'reporting analyst',
  'business intelligence analyst',
  'bi analyst',
  'insights analyst',
  'data and insights analyst',
  'reporting and insights analyst',
  'power bi analyst',
  'dashboard analyst',
  'sql reporting analyst',
  'decision support analyst',
  'data quality analyst',
  'healthcare data analyst',
  'compliance analyst',
  'risk analyst',
  'fraud analyst',
  'analytics consultant',
  'reporting consultant',
  'functional consultant',
  'business analyst'
] as const;

const CONSULTING_SIGNALS = [
  'client-facing',
  'client delivery',
  'requirements gathering',
  'process mapping',
  'business requirements',
  'functional requirements',
  'workshops',
  'stakeholder management',
  'solution design'
] as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function labelForScore(score: number): CvFitLabel {
  if (score >= 85) {
    return 'CV_MATCH';
  }
  if (score >= 70) {
    return 'GOOD_MATCH';
  }
  if (score >= 50) {
    return 'LESS_MATCH';
  }
  if (score >= 30) {
    return 'LOW_MATCH';
  }
  return 'EXCLUDE';
}

export function getCvFitForJob(input: CvFitInput): CvFitResult {
  const normalizedTitle = normalizeText(input.title);
  const normalizedDescription = normalizeText(input.description ?? '');
  const blob = `${normalizedTitle} ${normalizedDescription}`;
  const stretchByTitle =
    STRETCH_ROLE_KEYWORDS.some((keyword) => normalizedTitle.includes(normalizeText(keyword))) ||
    normalizedTitle.includes('senior') ||
    normalizedTitle.includes('lead') ||
    normalizedTitle.includes('principal') ||
    normalizedTitle.includes('director') ||
    normalizedTitle.includes('head of');

  const extracted = (input.extractedSkills ?? []).map((skill) => normalizeText(skill));
  const blobSkills = includesAny(blob, [...CV_PROFILE.coreSkills, ...STRONG_TOOL_SIGNALS]);
  const matchedSkills = [...new Set([...blobSkills, ...extracted.filter((x) => [...CV_PROFILE.coreSkills, ...STRONG_TOOL_SIGNALS].includes(x))])];

  const titleTrackHits = ROLE_TRACKS.filter((track) =>
    track.keywords.some((keyword) => normalizedTitle.includes(keyword))
  );
  const trackHits = ROLE_TRACKS.filter((track) => track.keywords.some((keyword) => blob.includes(keyword)));
  const matchedRoleTracks = [...new Set(trackHits.map((track) => track.label))];
  const highConfidenceTitle = HIGH_CONFIDENCE_TITLE_PATTERNS.some((pattern) => normalizedTitle.includes(pattern));
  const titleToolHits = includesAny(normalizedTitle, TITLE_TOOL_SIGNALS);
  const analyticsAnchor = highConfidenceTitle || trackHits.length > 0;

  const reasons: string[] = [];
  let score = 22;

  if (highConfidenceTitle) {
    score += 44;
    reasons.push('High-confidence title match to your target role universe');
  } else if (titleTrackHits.length) {
    score += 34;
    reasons.push(`Title aligns with ${titleTrackHits.map((track) => track.label).join(', ')}`);
  } else if (trackHits.length) {
    score += 20;
    reasons.push(`Description aligns with ${trackHits.map((track) => track.label).join(', ')}`);
  } else if (normalizedTitle.includes('analyst') || normalizedTitle.includes('consultant')) {
    score += 12;
    reasons.push('Adjacent analyst/consulting title with potential fit');
  }

  if (matchedSkills.length) {
    score += Math.min(30, matchedSkills.length * 4);
    reasons.push(`Skill overlap: ${matchedSkills.slice(0, 6).join(', ')}`);
  } else {
    reasons.push('Low explicit SQL/BI/reporting overlap');
    if (highConfidenceTitle) {
      score += 8;
      reasons.push('Title-fit boost applied where detailed description signals are sparse');
    }
  }

  if (titleToolHits.length) {
    score += Math.min(14, titleToolHits.length * 3);
    reasons.push(`Title tool/reporting signals: ${titleToolHits.slice(0, 3).join(', ')}`);
  }

  const domainOverlap = includesAny(blob, CV_PROFILE.domainSignals);
  if (domainOverlap.length) {
    score += Math.min(14, domainOverlap.length * 3);
    reasons.push(`Domain overlap: ${domainOverlap.slice(0, 3).join(', ')}`);
  }

  const consultingOverlap = includesAny(blob, CONSULTING_SIGNALS);
  if (consultingOverlap.length) {
    score += Math.min(10, consultingOverlap.length * 2);
    reasons.push(`Consulting/business-analysis signals: ${consultingOverlap.slice(0, 3).join(', ')}`);
  }

  const mismatch = includesAny(blob, HEAVY_MISMATCH);
  if (mismatch.length) {
    if (analyticsAnchor) {
      score -= 12;
      reasons.push('Mixed role signals detected; down-ranked for fit risk');
    } else {
      score -= 40;
      reasons.push('Role appears outside analytics-first target scope');
    }
  }

  const heavyEngineering = includesAny(blob, HEAVY_DATA_ENGINEERING);
  if (heavyEngineering.length >= 2) {
    if (analyticsAnchor) {
      score -= 10;
      reasons.push('Some deep engineering ownership signals detected');
    } else {
      score -= 24;
      reasons.push('Deep engineering/platform ownership signals detected');
    }
  }

  if (stretchByTitle) {
    score -= 12;
    reasons.push('Higher seniority role; treated as stretch/low priority');
  }

  if (input.seniorityLevel === 'DIRECTOR' || input.seniorityLevel === 'LEAD' || input.seniorityLevel === 'MANAGER') {
    score -= 8;
  }

  const finalScore = clamp(score);
  const label = labelForScore(finalScore);

  return {
    label,
    score: finalScore,
    reasons,
    matchedSkills,
    matchedRoleTracks
  };
}

export function getCvTargetRoles(): string[] {
  return [...CV_PROFILE.recommendedTargetRoles];
}
