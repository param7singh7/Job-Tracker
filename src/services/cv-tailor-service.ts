import { CV_PROFILE } from '@/src/config/cv-profile';
import { includesAny, normalizeText } from '@/src/lib/text';
import { getCvFitForJob } from '@/src/services/cv-fit-service';

interface CvTailorInput {
  title: string;
  companyName: string;
  locationText?: string | null;
  description?: string | null;
  extractedSkills?: string[] | null;
  seniorityLevel?: string | null;
}

export interface PotentialCvDraft {
  text: string;
  atsKeywords: string[];
}

const ATS_PRIORITY_TERMS = [
  'sql',
  'power bi',
  'dax',
  'power query',
  'tableau',
  'excel',
  'dashboard',
  'reporting',
  'kpi',
  'analytics',
  'insights',
  'data quality',
  'stakeholder reporting',
  'trend analysis',
  'forecasting',
  'ad hoc analysis',
  'fraud',
  'risk',
  'operations',
  'commercial',
  'customer insights',
  'product analytics',
  'marketing analytics',
  'sales analytics'
] as const;

function selectAtsKeywords(blob: string, extractedSkills: string[]): string[] {
  const signals = includesAny(blob, ATS_PRIORITY_TERMS);
  const merged = [...new Set([...signals, ...extractedSkills.map((x) => normalizeText(x))].filter(Boolean))];
  return merged.slice(0, 12);
}

function buildExperienceBullets(title: string, ats: string[]): string[] {
  const bullets: string[] = [];
  const has = (token: string) => ats.some((x) => x.includes(token));

  if (has('sql')) {
    bullets.push('Built robust SQL queries and reusable datasets for recurring and ad-hoc business reporting.');
  }
  if (has('power bi') || has('dax') || has('tableau') || has('dashboard')) {
    bullets.push('Designed KPI dashboards in Power BI/Tableau to track performance trends and support decision-making.');
  }
  if (has('excel') || has('power query')) {
    bullets.push('Automated manual reporting workflows using Excel and Power Query, improving turnaround time and accuracy.');
  }
  if (has('data quality')) {
    bullets.push('Implemented data quality checks and reconciliation logic to improve trust in reporting outputs.');
  }
  if (has('stakeholder') || has('reporting') || has('insights')) {
    bullets.push('Partnered with stakeholders to translate business questions into actionable analytics and concise insights.');
  }
  if (has('fraud') || has('risk')) {
    bullets.push('Analyzed risk/fraud patterns and delivered alerting and reporting views for faster issue detection.');
  }
  if (has('operations') || has('commercial') || has('customer') || has('product') || has('marketing')) {
    bullets.push('Delivered operational and commercial analytics to guide prioritization, performance monitoring, and planning.');
  }

  while (bullets.length < 5) {
    bullets.push('Produced clear weekly and monthly reporting packs with KPI commentary for cross-functional leadership.');
  }

  return bullets.slice(0, 6);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function buildPotentialCvDraft(input: CvTailorInput): PotentialCvDraft {
  const description = input.description ?? '';
  const normalizedBlob = normalizeText(`${input.title} ${description}`);
  const extractedSkills = (input.extractedSkills ?? []).map((skill) => normalizeText(skill));
  const atsKeywords = selectAtsKeywords(normalizedBlob, extractedSkills);
  const cvFit = getCvFitForJob({
    title: input.title,
    description,
    extractedSkills,
    seniorityLevel: input.seniorityLevel
  });

  const roleTitle = input.title.trim();
  const companyName = input.companyName.trim();
  const location = input.locationText?.trim() || CV_PROFILE.location;
  const focusSkills = atsKeywords.slice(0, 8).map((x) => titleCase(x)).join(', ');
  const bullets = buildExperienceBullets(roleTitle, atsKeywords).map((line) => `- ${line}`);
  const cvFitReason = cvFit.reasons[0] ?? 'Strong analytics alignment';

  const text = [
    `TARGET ROLE: ${roleTitle}`,
    `TARGET COMPANY: ${companyName}`,
    '',
    'PROFESSIONAL SUMMARY',
    `${CV_PROFILE.yearsExperience}+ years analytics experience in Ireland, focused on SQL-driven reporting, dashboarding, KPI ownership, and stakeholder insights. Applying for ${roleTitle} at ${companyName} (${location}).`,
    `${cvFitReason}.`,
    '',
    'CORE SKILLS TO HIGHLIGHT',
    focusSkills || 'SQL, Power BI, Tableau, Excel, Reporting, KPI Analysis',
    '',
    'EXPERIENCE BULLETS (PASTE UNDER RELEVANT ROLE)',
    ...bullets,
    '',
    'ATS KEYWORDS TO INCLUDE',
    atsKeywords.join(', ') || 'sql, power bi, tableau, reporting, dashboard, kpi',
    '',
    'SHORT COVER INTRO (OPTIONAL)',
    `I am applying for the ${roleTitle} position at ${companyName}. My background in SQL, BI reporting, and stakeholder-facing analytics aligns well with this role, and I can contribute quickly to KPI tracking, dashboard delivery, and actionable insights.`
  ].join('\n');

  return {
    text,
    atsKeywords
  };
}
