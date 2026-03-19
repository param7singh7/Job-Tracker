import { SourceName } from '@prisma/client';
import { describe, expect, test } from 'vitest';
import { scoreJob } from '@/src/services/scoring-engine';
import { deduplicateJobs } from '@/src/services/deduplication-engine';
import { baseJob } from '@/tests/test-helpers';

describe('deduplication engine', () => {
  test('merges duplicates from multiple sources', () => {
    const first = baseJob({
      sourcePrimary: SourceName.INDEED,
      sourceJobId: 'indeed-1',
      applyUrl: 'https://example.com/apply/abc'
    });

    const second = baseJob({
      sourcePrimary: SourceName.LINKEDIN,
      sourceJobId: 'linkedin-1',
      applyUrl: 'https://example.com/apply/abc'
    });

    const scoredFirst = { ...first, score: scoreJob(first) };
    const scoredSecond = { ...second, score: scoreJob(second) };

    const result = deduplicateJobs([scoredFirst, scoredSecond]);

    expect(result.groups.length).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.groups[0].members.length).toBe(2);
    expect(result.duplicateReasons.apply_url).toBe(1);
  });

  test('keeps same title/company when location differs', () => {
    const first = baseJob({
      sourcePrimary: SourceName.LINKEDIN,
      sourceJobId: 'linkedin-1',
      title: 'Business Intelligence Analyst',
      companyName: 'Example Co',
      locationText: 'Dublin, County Dublin, Ireland',
      sourceUrl: 'https://www.linkedin.com/jobs/view/1234567890/',
      applyUrl: 'https://www.linkedin.com/jobs/view/1234567890/'
    });

    const second = baseJob({
      sourcePrimary: SourceName.LINKEDIN,
      sourceJobId: 'linkedin-2',
      title: 'Business Intelligence Analyst',
      companyName: 'Example Co',
      locationText: 'Cork, County Cork, Ireland',
      sourceUrl: 'https://www.linkedin.com/jobs/view/1234567891/',
      applyUrl: 'https://www.linkedin.com/jobs/view/1234567891/'
    });

    const scoredFirst = { ...first, score: scoreJob(first) };
    const scoredSecond = { ...second, score: scoreJob(second) };
    const result = deduplicateJobs([scoredFirst, scoredSecond]);

    expect(result.groups.length).toBe(2);
    expect(result.duplicates).toBe(0);
  });
});
