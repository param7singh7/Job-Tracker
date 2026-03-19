import { describe, expect, test } from 'vitest';
import { scoreJob } from '@/src/services/scoring-engine';
import { baseJob } from '@/tests/test-helpers';

describe('scoring engine', () => {
  test('rewards high-fit junior analytics role', () => {
    const score = scoreJob(baseJob());

    expect(score.final_score).toBeGreaterThan(75);
    expect(score.match_level).toMatch(/APPLY_NOW|STRONG_MATCH/);
    expect(score.classification).toBe('RELEVANT');
  });

  test('down-ranks heavy engineering role', () => {
    const score = scoreJob(
      baseJob({
        title: 'Machine Learning Engineer',
        titleNormalized: 'machine learning engineer',
        excludedKeywords: ['machine learning engineer'],
        extractedSkills: ['python']
      })
    );

    expect(score.final_score).toBeLessThan(60);
    expect(score.classification).toBe('EXCLUDED');
  });

  test('excludes support-first role without analytics crossover', () => {
    const score = scoreJob(
      baseJob({
        title: 'IT Support Analyst',
        titleNormalized: 'it support analyst',
        descriptionRaw: 'Handle service desk tickets and incident management for end users',
        descriptionClean: 'Handle service desk tickets and incident management for end users',
        extractedSkills: ['service desk'],
        excludedKeywords: ['it support']
      })
    );

    expect(score.classification).toBe('EXCLUDED');
    expect(score.match_level).toBe('EXCLUDE');
  });
});
