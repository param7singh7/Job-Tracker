import { addDays, isAfter, isBefore } from 'date-fns';
import { ScoredJob } from '@/src/types/job';
import { hashableKey, normalizeText, tokens } from '@/src/lib/text';

export interface DedupeGroup {
  canonical: ScoredJob;
  members: ScoredJob[];
}

type DuplicateReason = 'source_job_id' | 'linkedin_job_id' | 'apply_url' | 'source_url' | 'high_confidence_identity';

function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));

  if (!setA.size || !setB.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(setA.size, setB.size);
}

function canonicalizeUrl(url?: string): string {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';

    const host = parsed.hostname.toLowerCase();
    if (host.includes('linkedin.com')) {
      const linkedInId = extractLinkedInJobId(url);
      if (linkedInId) {
        return `https://www.linkedin.com/jobs/view/${linkedInId}/`;
      }
    }

    return parsed.toString().toLowerCase();
  } catch {
    return url.split('?')[0]?.trim().toLowerCase() ?? '';
  }
}

function postedDatesClose(a?: Date, b?: Date): boolean {
  if (!a || !b) {
    return true;
  }

  const min = addDays(a, -3);
  const max = addDays(a, 3);
  return isAfter(b, min) && isBefore(b, max);
}

function extractLinkedInJobId(value?: string): string | null {
  if (!value) {
    return null;
  }

  const fromPath = value.match(/\/jobs\/view\/(?:[^/?#]+-)?(\d+)/i)?.[1];
  if (fromPath) {
    return fromPath;
  }

  const fromQuery = value.match(/[?&](?:currentJobId|jobId)=(\d{6,})/i)?.[1];
  if (fromQuery) {
    return fromQuery;
  }

  return null;
}

function normalizedLocation(value?: string): string {
  return normalizeText(value ?? '');
}

function duplicateDecision(a: ScoredJob, b: ScoredJob): { duplicate: boolean; reason?: DuplicateReason } {
  if (a.sourcePrimary === b.sourcePrimary && a.sourceJobId && b.sourceJobId && a.sourceJobId === b.sourceJobId) {
    return { duplicate: true, reason: 'source_job_id' };
  }

  const linkedinA = extractLinkedInJobId(a.sourceUrl) ?? extractLinkedInJobId(a.applyUrl) ?? extractLinkedInJobId(a.sourceJobId);
  const linkedinB = extractLinkedInJobId(b.sourceUrl) ?? extractLinkedInJobId(b.applyUrl) ?? extractLinkedInJobId(b.sourceJobId);
  if (linkedinA && linkedinB && linkedinA === linkedinB) {
    return { duplicate: true, reason: 'linkedin_job_id' };
  }

  const applyA = canonicalizeUrl(a.applyUrl);
  const applyB = canonicalizeUrl(b.applyUrl);
  if (applyA && applyB && applyA === applyB) {
    return { duplicate: true, reason: 'apply_url' };
  }

  const sourceA = canonicalizeUrl(a.sourceUrl);
  const sourceB = canonicalizeUrl(b.sourceUrl);
  if (sourceA && sourceB && sourceA === sourceB) {
    return { duplicate: true, reason: 'source_url' };
  }

  const companyA = normalizeText(a.companyName);
  const companyB = normalizeText(b.companyName);
  const companyKnown = !['unknown', 'confidential', 'n/a'].includes(companyA) && !['unknown', 'confidential', 'n/a'].includes(companyB);
  const companySame = companyKnown && companyA === companyB;
  const locationA = normalizedLocation(a.locationText);
  const locationB = normalizedLocation(b.locationText);
  const locationSame = locationA !== '' && locationB !== '' && locationA === locationB;
  const titleSim = tokenSimilarity(a.title, b.title);
  const descriptionSim = tokenSimilarity(a.descriptionClean ?? a.descriptionRaw ?? '', b.descriptionClean ?? b.descriptionRaw ?? '');

  const veryHighIdentity =
    companySame &&
    locationSame &&
    titleSim >= 0.96 &&
    descriptionSim >= 0.9 &&
    postedDatesClose(a.postedAt, b.postedAt);

  if (veryHighIdentity) {
    return { duplicate: true, reason: 'high_confidence_identity' };
  }

  return { duplicate: false };
}

export function deduplicateJobs(jobs: ScoredJob[]): {
  groups: DedupeGroup[];
  duplicates: number;
  duplicateReasons: Record<string, number>;
} {
  const sorted = [...jobs].sort((a, b) => {
    const bDate = b.postedAt?.getTime() ?? 0;
    const aDate = a.postedAt?.getTime() ?? 0;
    if (bDate !== aDate) {
      return bDate - aDate;
    }

    return b.score.final_score - a.score.final_score;
  });

  const groups: DedupeGroup[] = [];
  const duplicateReasons: Record<string, number> = {};

  for (const job of sorted) {
    let matchedGroup: DedupeGroup | null = null;
    let matchedReason: DuplicateReason | undefined;

    for (const group of groups) {
      const decision = duplicateDecision(group.canonical, job);
      if (!decision.duplicate) {
        continue;
      }

      matchedGroup = group;
      matchedReason = decision.reason;
      break;
    }

    if (!matchedGroup) {
      groups.push({
        canonical: job,
        members: [job]
      });
      continue;
    }

    matchedGroup.members.push(job);
    if (matchedReason) {
      duplicateReasons[matchedReason] = (duplicateReasons[matchedReason] ?? 0) + 1;
    }
  }

  for (const group of groups) {
    const sortedMembers = [...group.members].sort((a, b) => {
      if (b.score.final_score !== a.score.final_score) {
        return b.score.final_score - a.score.final_score;
      }

      const aKey = `${a.sourcePrimary}|${a.sourceJobId}|${a.sourceUrl ?? ''}`;
      const bKey = `${b.sourcePrimary}|${b.sourceJobId}|${b.sourceUrl ?? ''}`;
      return aKey.localeCompare(bKey);
    });
    const best = sortedMembers[0];
    group.canonical = best;

    const groupId = hashableKey(
      sortedMembers.map((member) =>
        hashableKey([
          member.sourcePrimary,
          member.sourceJobId,
          member.sourceUrl,
          member.applyUrl,
          member.title,
          member.companyName,
          member.locationText,
          member.postedAt?.toISOString()
        ])
      )
    );
    group.members = group.members.map((member) => ({
      ...member,
      duplicateGroupId: groupId
    }));
    group.canonical = {
      ...group.canonical,
      duplicateGroupId: groupId
    };
  }

  const duplicates = groups.reduce((acc, group) => acc + Math.max(0, group.members.length - 1), 0);

  return {
    groups,
    duplicates,
    duplicateReasons
  };
}
