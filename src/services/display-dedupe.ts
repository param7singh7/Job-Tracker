import { normalizeText } from '@/src/lib/text';

export interface DisplayDedupeSource {
  sourceName?: string;
  sourceUrl?: string | null;
  applyUrl?: string | null;
}

export interface DisplayDedupeJob<TSource extends DisplayDedupeSource = DisplayDedupeSource> {
  title: string;
  companyNameCached: string;
  city?: string | null;
  locationText?: string | null;
  applyUrl?: string | null;
  postedAt?: Date | null;
  discoveredAt?: Date | null;
  finalScore: number;
  jobSources: TSource[];
}

export interface DisplayDedupeOptions {
  collapseMultiLocationDuplicates?: boolean;
}

function extractLinkedInJobId(url?: string): string | null {
  if (!url) {
    return null;
  }

  const fromPath = url.match(/\/jobs\/view\/(?:[^/?#]+-)?(\d+)/i)?.[1];
  if (fromPath) {
    return fromPath;
  }

  const fromQuery = url.match(/[?&](?:currentJobId|jobId)=(\d{6,})/i)?.[1];
  if (fromQuery) {
    return fromQuery;
  }

  return null;
}

function canonicalizeUrl(url?: string | null): string {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('linkedin.com')) {
      const linkedInId = extractLinkedInJobId(url);
      if (linkedInId) {
        return `https://www.linkedin.com/jobs/view/${linkedInId}/`;
      }
      parsed.hostname = 'www.linkedin.com';
    }

    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().toLowerCase();
  } catch {
    return url.split('?')[0]?.trim().toLowerCase() ?? '';
  }
}

function primaryJobUrl<TSource extends DisplayDedupeSource>(job: DisplayDedupeJob<TSource>): string {
  if (job.applyUrl) {
    return canonicalizeUrl(job.applyUrl);
  }

  for (const source of job.jobSources) {
    const url = canonicalizeUrl(source.applyUrl ?? source.sourceUrl);
    if (url) {
      return url;
    }
  }

  return '';
}

function dateKey(value?: Date | null): string {
  if (!value) {
    return 'n/a';
  }

  return value.toISOString().slice(0, 10);
}

function dedupeKey<TSource extends DisplayDedupeSource>(job: DisplayDedupeJob<TSource>): string {
  const url = primaryJobUrl(job);
  if (url) {
    return `url|${url}`;
  }

  const linkedInIdFromJob = extractLinkedInJobId(job.applyUrl ?? undefined);
  if (linkedInIdFromJob) {
    return `linkedin|${linkedInIdFromJob}`;
  }

  for (const source of job.jobSources) {
    const linkedInId = extractLinkedInJobId(source.applyUrl ?? source.sourceUrl ?? undefined);
    if (linkedInId) {
      return `linkedin|${linkedInId}`;
    }
  }

  return [
    'fallback',
    normalizeText(job.title),
    normalizeText(job.companyNameCached),
    normalizeText(job.city ?? job.locationText ?? ''),
    dateKey(job.postedAt)
  ].join('|');
}

function collapseKey<TSource extends DisplayDedupeSource>(job: DisplayDedupeJob<TSource>): string {
  const date = job.postedAt ?? job.discoveredAt ?? null;
  return ['collapse', normalizeText(job.title), normalizeText(job.companyNameCached), dateKey(date)].join('|');
}

function sourceKey(source: DisplayDedupeSource): string {
  return [
    normalizeText(source.sourceName ?? ''),
    canonicalizeUrl(source.applyUrl),
    canonicalizeUrl(source.sourceUrl)
  ].join('|');
}

function mergeSources<TSource extends DisplayDedupeSource>(primary: TSource[], secondary: TSource[]): TSource[] {
  const merged: TSource[] = [];
  const seen = new Set<string>();

  for (const source of [...primary, ...secondary]) {
    const key = sourceKey(source);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(source);
  }

  return merged;
}

function scoreTuple<TSource extends DisplayDedupeSource>(job: DisplayDedupeJob<TSource>): [number, number, number] {
  return [job.postedAt?.getTime() ?? 0, job.finalScore ?? 0, job.discoveredAt?.getTime() ?? 0];
}

function isBetterCandidate<TSource extends DisplayDedupeSource>(
  incoming: DisplayDedupeJob<TSource>,
  current: DisplayDedupeJob<TSource>
): boolean {
  const [ip, is, id] = scoreTuple(incoming);
  const [cp, cs, cd] = scoreTuple(current);

  if (ip !== cp) {
    return ip > cp;
  }

  if (is !== cs) {
    return is > cs;
  }

  return id > cd;
}

export function dedupeJobsForDisplay<T extends DisplayDedupeJob>(jobs: T[]): T[] {
  return dedupeJobsForDisplayWithOptions(jobs, {});
}

export function dedupeJobsForDisplayWithOptions<T extends DisplayDedupeJob>(
  jobs: T[],
  options: DisplayDedupeOptions
): T[] {
  const byKey = new Map<string, T>();

  for (const job of jobs) {
    const key = dedupeKey(job);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, job);
      continue;
    }

    const keepIncoming = isBetterCandidate(job, existing);
    const winner = keepIncoming ? job : existing;
    const loser = keepIncoming ? existing : job;

    byKey.set(key, {
      ...winner,
      jobSources: mergeSources(winner.jobSources, loser.jobSources)
    } as T);
  }

  let deduped = [...byKey.values()];

  if (options.collapseMultiLocationDuplicates) {
    const byCollapseKey = new Map<string, T>();

    for (const job of deduped) {
      const key = collapseKey(job);
      const existing = byCollapseKey.get(key);

      if (!existing) {
        byCollapseKey.set(key, job);
        continue;
      }

      const keepIncoming = isBetterCandidate(job, existing);
      const winner = keepIncoming ? job : existing;
      const loser = keepIncoming ? existing : job;

      byCollapseKey.set(key, {
        ...winner,
        jobSources: mergeSources(winner.jobSources, loser.jobSources)
      } as T);
    }

    deduped = [...byCollapseKey.values()];
  }

  return deduped.sort((a, b) => {
    const postedDiff = (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0);
    if (postedDiff !== 0) {
      return postedDiff;
    }

    return (b.finalScore ?? 0) - (a.finalScore ?? 0);
  });
}
