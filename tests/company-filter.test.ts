import { describe, expect, test } from 'vitest';
import { isRecruitmentOrConsultancyCompany } from '@/src/lib/company-filter';

describe('company filter', () => {
  test('flags recruitment and consultancy firms', () => {
    expect(isRecruitmentOrConsultancyCompany('Talentspot Recruitment')).toBe(true);
    expect(isRecruitmentOrConsultancyCompany('Lex Consultancy Recruitment')).toBe(true);
    expect(isRecruitmentOrConsultancyCompany('Morgan McKinley')).toBe(true);
    expect(isRecruitmentOrConsultancyCompany('Harvey Nash')).toBe(true);
    expect(isRecruitmentOrConsultancyCompany('Version 1')).toBe(true);
    expect(isRecruitmentOrConsultancyCompany('Accenture UK & Ireland')).toBe(true);
  });

  test('keeps direct employers', () => {
    expect(isRecruitmentOrConsultancyCompany('Amazon')).toBe(false);
    expect(isRecruitmentOrConsultancyCompany('AIB')).toBe(false);
    expect(isRecruitmentOrConsultancyCompany('Musgrave')).toBe(false);
  });
});
