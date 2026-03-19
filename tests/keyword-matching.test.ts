import { describe, expect, test } from 'vitest';
import { matchKeywords } from '@/src/services/keyword-matcher';

describe('keyword matcher', () => {
  test('captures analytics and skill signals', () => {
    const result = matchKeywords(
      'Reporting Analyst',
      'Build Power BI dashboards with SQL and KPI reporting for stakeholders'
    );

    expect(result.titleMatches).toContain('reporting analyst');
    expect(result.descriptionMatches).toContain('power bi');
    expect(result.extractedSkills).toContain('sql');
    expect(result.extractedSkills).toContain('dashboard');
  });

  test('captures exclusion patterns', () => {
    const result = matchKeywords('Data Engineer', 'Own ETL and platform engineering with Airflow');
    expect(result.excludedMatches).toContain('data engineer');
  });
});
