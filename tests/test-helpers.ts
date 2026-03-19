import { EmploymentType, SeniorityLevel, SourceName, WorkMode } from '@prisma/client';
import { NormalizedJobDraft } from '@/src/types/job';

export function baseJob(overrides?: Partial<NormalizedJobDraft>): NormalizedJobDraft {
  return {
    sourcePrimary: SourceName.INDEED,
    sourceJobId: 'base-1',
    sourceUrl: 'https://example.com/job/1',
    applyUrl: 'https://example.com/job/1/apply',
    title: 'Data Analyst',
    titleNormalized: 'data analyst',
    companyName: 'Example Co',
    companyNameNormalized: 'example co',
    locationText: 'Dublin, Ireland',
    city: 'Dublin',
    county: 'Dublin',
    country: 'Ireland',
    workMode: WorkMode.HYBRID,
    employmentType: EmploymentType.FULL_TIME,
    seniorityLevel: SeniorityLevel.JUNIOR,
    descriptionRaw: 'SQL, Power BI, dashboard reporting and stakeholder insights',
    descriptionClean: 'SQL, Power BI, dashboard reporting and stakeholder insights',
    postedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    discoveredAt: new Date(),
    salaryMin: 45000,
    salaryMax: 55000,
    salaryCurrency: 'EUR',
    sponsorshipMentioned: false,
    workAuthorizationMentioned: false,
    extractedSkills: ['sql', 'power bi', 'dashboard', 'reporting'],
    matchedKeywords: ['data analyst', 'sql', 'dashboard'],
    excludedKeywords: [],
    scanConfidence: 0.9,
    canonicalKey: 'data analyst|example co|dublin|ireland',
    duplicateGroupId: 'group-1',
    ...overrides
  };
}
