import { describe, expect, test } from 'vitest';
import { scoreJob } from '@/src/services/scoring-engine';
import { baseJob } from '@/tests/test-helpers';

describe('classification', () => {
  test('excludes strongly irrelevant role', () => {
    const job = baseJob({
      title: 'Head of Machine Learning Platform',
      titleNormalized: 'head of machine learning platform',
      excludedKeywords: ['head of', 'machine learning engineer']
    });

    const score = scoreJob(job);
    expect(score.match_level).toBe('EXCLUDE');
    expect(score.classification).toBe('EXCLUDED');
  });
});
