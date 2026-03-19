import { describe, expect, test } from 'vitest';
import { buildPotentialCvDraft } from '@/src/services/cv-tailor-service';

describe('cv tailor service', () => {
  test('builds copy-ready tailored cv text', () => {
    const draft = buildPotentialCvDraft({
      title: 'Data & Business Intelligence Analyst',
      companyName: 'Example Corp',
      locationText: 'Dublin, Ireland',
      description:
        'Need SQL, Power BI, Tableau, dashboard reporting, KPI ownership, and stakeholder reporting for commercial analytics.',
      extractedSkills: ['sql', 'power bi', 'tableau', 'dashboard', 'kpi']
    });

    expect(draft.text).toContain('TARGET ROLE: Data & Business Intelligence Analyst');
    expect(draft.text).toContain('TARGET COMPANY: Example Corp');
    expect(draft.text).toContain('ATS KEYWORDS TO INCLUDE');
    expect(draft.atsKeywords).toContain('sql');
    expect(draft.atsKeywords).toContain('power bi');
  });
});
