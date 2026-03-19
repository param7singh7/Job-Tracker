import { describe, expect, test } from 'vitest';
import { dedupeJobsForDisplay } from '@/src/services/display-dedupe';

function sampleJob(overrides?: Partial<{
  title: string;
  companyNameCached: string;
  city: string | null;
  locationText: string | null;
  applyUrl: string | null;
  postedAt: Date | null;
  discoveredAt: Date | null;
  finalScore: number;
  jobSources: Array<{ sourceName: string; sourceUrl: string | null; applyUrl: string | null }>;
}>) {
  return {
    title: 'Data Analyst',
    companyNameCached: 'Example Co',
    city: 'Dublin',
    locationText: 'Dublin, Ireland',
    applyUrl: 'https://www.linkedin.com/jobs/view/1234567890/',
    postedAt: new Date('2026-03-18T09:00:00.000Z'),
    discoveredAt: new Date('2026-03-18T10:00:00.000Z'),
    finalScore: 72,
    jobSources: [{ sourceName: 'LINKEDIN', sourceUrl: 'https://www.linkedin.com/jobs/view/1234567890/', applyUrl: null }],
    ...overrides
  };
}

describe('display dedupe', () => {
  test('collapses duplicate jobs with same canonical url', () => {
    const first = sampleJob({
      applyUrl: 'https://ie.linkedin.com/jobs/view/data-analyst-1234567890?trk=abc'
    });

    const second = sampleJob({
      finalScore: 88,
      postedAt: new Date(first.postedAt ? first.postedAt.getTime() + 60_000 : Date.now()),
      applyUrl: 'https://www.linkedin.com/jobs/view/1234567890/'
    });

    const deduped = dedupeJobsForDisplay([first, second]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].finalScore).toBe(88);
  });

  test('uses fallback key when urls are missing', () => {
    const first = sampleJob({
      applyUrl: null,
      jobSources: []
    });
    const second = sampleJob({
      finalScore: 77,
      applyUrl: null,
      jobSources: []
    });

    const deduped = dedupeJobsForDisplay([first, second]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].finalScore).toBe(77);
  });
});
