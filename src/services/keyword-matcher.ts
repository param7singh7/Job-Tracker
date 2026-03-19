import {
  DESCRIPTION_SIGNAL_KEYWORDS,
  NEGATIVE_KEYWORDS,
  POSITIVE_SENIORITY_KEYWORDS,
  RESPONSIBILITY_KEYWORDS,
  ROLE_FAMILY_CLUSTERS,
  SENIORITY_NEGATIVE_KEYWORDS,
  TITLE_POSITIVE_KEYWORDS,
  TOOL_KEYWORDS
} from '@/src/config/keywords';
import { includesAny, normalizeText } from '@/src/lib/text';

export interface KeywordMatchResult {
  titleMatches: string[];
  descriptionMatches: string[];
  excludedMatches: string[];
  positiveSeniorityMatches: string[];
  negativeSeniorityMatches: string[];
  extractedSkills: string[];
  toolMatches: string[];
  responsibilityMatches: string[];
  roleFamilyHits: Record<keyof typeof ROLE_FAMILY_CLUSTERS, number>;
  titleOnlyMatchCount: number;
  descriptionOnlyMatchCount: number;
  titleAndDescriptionMatchCount: number;
}

export function matchKeywords(title: string, description?: string): KeywordMatchResult {
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description ?? '');
  const blob = `${normalizedTitle} ${normalizedDescription}`;

  const titleMatches = includesAny(normalizedTitle, TITLE_POSITIVE_KEYWORDS);
  const descriptionMatches = includesAny(normalizedDescription, DESCRIPTION_SIGNAL_KEYWORDS);
  const excludedMatches = includesAny(blob, NEGATIVE_KEYWORDS);
  const positiveSeniorityMatches = includesAny(blob, POSITIVE_SENIORITY_KEYWORDS);
  const negativeSeniorityMatches = includesAny(blob, SENIORITY_NEGATIVE_KEYWORDS);
  const toolMatches = includesAny(blob, TOOL_KEYWORDS);
  const responsibilityMatches = includesAny(blob, RESPONSIBILITY_KEYWORDS);

  const extractedSkills = [...new Set([...toolMatches, ...descriptionMatches.filter((value) => value.length <= 24)])];

  const roleFamilyHits = Object.entries(ROLE_FAMILY_CLUSTERS).reduce(
    (acc, [family, terms]) => {
      acc[family as keyof typeof ROLE_FAMILY_CLUSTERS] = includesAny(blob, terms).length;
      return acc;
    },
    {} as Record<keyof typeof ROLE_FAMILY_CLUSTERS, number>
  );

  const titleOnlyMatchCount = titleMatches.filter((match) => !descriptionMatches.includes(match)).length;
  const descriptionOnlyMatchCount = descriptionMatches.filter((match) => !titleMatches.includes(match)).length;
  const titleAndDescriptionMatchCount = titleMatches.filter((match) => descriptionMatches.includes(match)).length;

  return {
    titleMatches,
    descriptionMatches,
    excludedMatches,
    positiveSeniorityMatches,
    negativeSeniorityMatches,
    extractedSkills,
    toolMatches,
    responsibilityMatches,
    roleFamilyHits,
    titleOnlyMatchCount,
    descriptionOnlyMatchCount,
    titleAndDescriptionMatchCount
  };
}
