import { Prisma } from '@prisma/client';
import { normalizeText } from '@/src/lib/text';

const COMPANY_BLOCK_PATTERNS: RegExp[] = [
  /\brecruit(ment|ing|er|ers)?\b/i,
  /\bstaffing\b/i,
  /\bconsult(ancy|ing|ant|ants)\b/i,
  /\btalent\b/i,
  /\bexecutive\s+search\b/i,
  /\bsearch\s+and\s+selection\b/i,
  /\bsearch\s+partners?\b/i,
  /\bheadhunt(er|ing|ers)?\b/i,
  /\bheadcount\s+solutions?\b/i,
  /\bresourc(e|es|ing)\b/i,
  /\bplacement\b/i
];

const KNOWN_RECRUITMENT_BRANDS = [
  'morgan mckinley',
  'harvey nash',
  'hays',
  'fruition group',
  'archer recruitment',
  'brightwater recruitment',
  'realtime recruitment',
  'the panel',
  'broadgate',
  'coopman search',
  'e frontiers',
  'eirkoo',
  'first point group',
  'hr search',
  'hrm search partners',
  'barden',
  'talentspot recruitment',
  'lex consultancy recruitment',
  'coyle consulting',
  'methodius it recruitment',
  'elwood roberts',
  'hibernian recruitment',
  'artemis human capital'
] as const;

const KNOWN_CONSULTANCY_BRANDS = [
  'version 1',
  'accenture',
  'capgemini',
  'cognizant',
  'deloitte',
  'pwc',
  'ey',
  'kpmg',
  'grant thornton',
  'expleo',
  'mckinsey',
  'bain and company',
  'boston consulting group',
  'bcg'
] as const;

export const COMPANY_BLOCKLIST_TERMS = [
  'recruitment',
  'recruiting',
  'recruiter',
  'staffing',
  'consultancy',
  'consulting',
  'talent',
  'executive search',
  'search and selection',
  'search partners',
  'headcount solutions',
  'resourcing',
  'placement',
  ...KNOWN_RECRUITMENT_BRANDS,
  ...KNOWN_CONSULTANCY_BRANDS
] as const;

export function isRecruitmentOrConsultancyCompany(companyName?: string | null): boolean {
  const normalized = normalizeText(companyName);
  if (!normalized) {
    return false;
  }

  if (KNOWN_RECRUITMENT_BRANDS.some((brand) => normalized.includes(brand))) {
    return true;
  }

  if (KNOWN_CONSULTANCY_BRANDS.some((brand) => normalized.includes(brand))) {
    return true;
  }

  return COMPANY_BLOCK_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function recruitmentExclusionWhere(): Prisma.JobWhereInput {
  return {
    NOT: {
      OR: COMPANY_BLOCKLIST_TERMS.map((term) => ({
        companyNameCached: {
          contains: term,
          mode: 'insensitive'
        }
      }))
    }
  };
}
