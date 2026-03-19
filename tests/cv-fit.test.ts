import { describe, expect, test } from 'vitest';
import { getCvFitForJob } from '@/src/services/cv-fit-service';

describe('cv fit service', () => {
  test('marks reporting analyst role as cv/good fit', () => {
    const result = getCvFitForJob({
      title: 'Reporting Analyst',
      description: 'Build SQL queries, Power BI dashboards and KPI reports for business stakeholders.',
      extractedSkills: ['sql', 'power bi', 'dashboard', 'reporting']
    });

    expect(result.label).toMatch(/CV_MATCH|GOOD_MATCH/);
    expect(result.matchedSkills).toContain('sql');
  });

  test('down-ranks engineering-heavy roles', () => {
    const result = getCvFitForJob({
      title: 'Senior Data Engineer',
      description: 'Own ETL platform architecture, dbt pipelines and infra reliability.'
    });

    expect(result.label).toMatch(/LOW_MATCH|EXCLUDE|LESS_MATCH/);
  });
});
