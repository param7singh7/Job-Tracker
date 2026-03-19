import { SourceName } from '@prisma/client';
import { SEARCH_KEYWORD_GROUPS } from './keywords';

export const DEFAULT_INCLUDED_SOURCES: SourceName[] = [
  SourceName.LINKEDIN,
  SourceName.INDEED,
  SourceName.GLASSDOOR
];

export const DEFAULT_SEARCH_CONFIG = {
  includedSources: DEFAULT_INCLUDED_SOURCES,
  keywordGroups: SEARCH_KEYWORD_GROUPS,
  excludedKeywordGroups: [
    'it support',
    'service desk',
    'helpdesk',
    'desktop support',
    'machine learning engineer',
    'software engineer',
    'devops',
    'director'
  ],
  locationFilters: ['Ireland', 'Remote - Ireland', 'Hybrid - Ireland'],
  minimumScore: 0,
  applyNowThreshold: 80,
  includeStretchRoles: true,
  includeContractJobs: true,
  includeGraduateRoles: true,
  includeRemoteIreland: true,
  includeSuspiciousMatches: false,
  refreshFrequencyMinutes: 360
};
