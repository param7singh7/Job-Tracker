import { SourceName } from '@prisma/client';
import { ELIGIBLE_ROLE_UNIVERSE, STRETCH_ROLE_KEYWORDS } from '@/src/config/keywords';
import { RawProviderJob } from '@/src/types/job';

const REFERENCE_NOW = new Date('2026-03-17T10:00:00Z');
const DAYS_FROM_JAN_1_TO_MAR_17 = 75;

const PROVIDERS: SourceName[] = [
  SourceName.INDEED,
  SourceName.LINKEDIN,
  SourceName.JOBSIRELAND,
  SourceName.IRISHJOBS,
  SourceName.GLASSDOOR
];

function toDisplayRole(role: string): string {
  const acronyms = new Set(['bi', 'mi', 'mis', 'sql', 'kpi', 'crm', 'dax', 'fp&a']);
  const lowerWords = new Set(['and', 'or', 'of', 'for', 'in', 'to', 'with', 'the', 'a', 'an']);

  return role.replace(/[a-z0-9&]+/gi, (part, offset) => {
    const lower = part.toLowerCase();
    if (acronyms.has(lower)) {
      return lower.toUpperCase();
    }

    if (offset > 0 && lowerWords.has(lower)) {
      return lower;
    }

    return `${lower[0].toUpperCase()}${lower.slice(1)}`;
  });
}

const ANALYTICS_TITLES: readonly string[] = [...ELIGIBLE_ROLE_UNIVERSE, ...STRETCH_ROLE_KEYWORDS].map(toDisplayRole);

const STRETCH_MOCK_TITLES = new Set(STRETCH_ROLE_KEYWORDS.map(toDisplayRole));

const COMPANIES = [
  'AIB',
  'Bank of Ireland',
  'Ryanair',
  'Kerry Group',
  'Musgrave',
  'Bord Gais Energy',
  'ESB',
  'Aer Lingus',
  'Permanent TSB',
  'FBD Insurance',
  'Vodafone Ireland',
  'Eir',
  'Dunnes Stores',
  'Tesco Ireland',
  'An Post',
  'Irish Life',
  'Primark',
  'Version 1',
  'SSE Airtricity',
  'Three Ireland',
  'Irish Distillers',
  'Abbott Ireland',
  'CPL',
  'Mater Private Network',
  'Fenergo',
  'Deloitte Ireland',
  'EY Ireland',
  'PwC Ireland',
  'KPMG Ireland',
  'Stripe',
  'PayPal Ireland',
  'HubSpot',
  'Salesforce Ireland',
  'Mastercard',
  'Accenture',
  'Google Ireland',
  'Amazon Ireland',
  'TikTok Ireland',
  'Keurig Dr Pepper',
  'Aramark Ireland',
  'Smyths Toys',
  'Smurfit Kappa',
  'Ornua',
  'KPMG Lighthouse',
  'ICON plc',
  'Aon Ireland'
] as const;

const LOCATIONS = [
  'Dublin, Ireland',
  'Cork, Ireland',
  'Galway, Ireland',
  'Limerick, Ireland',
  'Waterford, Ireland',
  'Kilkenny, Ireland',
  'Wexford, Ireland',
  'Navan, Meath, Ireland',
  'Naas, Kildare, Ireland',
  'Bray, Wicklow, Ireland',
  'Ennis, Clare, Ireland',
  'Castlebar, Mayo, Ireland',
  'Sligo, Ireland',
  'Remote - Ireland',
  'Hybrid - Ireland',
  'Dublin 2, Ireland',
  'Cork City, Ireland'
] as const;

const FOCUS_AREAS = [
  'weekly stakeholder reporting and KPI ownership',
  'commercial trend analysis and variance reporting',
  'customer behavior insights and segmentation',
  'operations dashboarding and service performance tracking',
  'data quality controls and exception analysis',
  'marketing campaign measurement and funnel reporting',
  'product adoption analytics and retention insights',
  'revenue leakage detection and pricing analytics',
  'workforce demand forecasting and planning support',
  'risk monitoring and fraud indicator reporting',
  'management information pack production and executive reporting',
  'BI dashboard lifecycle ownership and data quality controls',
  'regulatory reporting and data reconciliation',
  'sales operations analytics and pipeline performance reporting'
] as const;

const SKILL_BUNDLES: ReadonlyArray<readonly string[]> = [
  ['SQL', 'Excel', 'Power BI', 'dashboard reporting', 'KPI analysis'],
  ['SQL', 'Tableau', 'ad hoc analysis', 'stakeholder reporting', 'trend analysis'],
  ['Excel', 'Power Query', 'DAX', 'Power BI', 'data visualization'],
  ['SQL', 'Python', 'report automation', 'insights', 'data quality'],
  ['SQL', 'Tableau', 'KPI reporting', 'business intelligence', 'analytics'],
  ['SQL', 'Excel', 'Power BI', 'data validation', 'operational reporting'],
  ['SQL', 'Python', 'Tableau', 'fraud analysis', 'risk reporting'],
  ['Excel', 'Power Query', 'Power BI', 'stakeholder reporting', 'variance analysis']
];

const SALARY_BANDS = [
  'EUR 36,000 - 48,000',
  'EUR 40,000 - 55,000',
  'EUR 45,000 - 62,000',
  'EUR 50,000 - 70,000',
  'EUR 55,000 - 75,000'
] as const;

function sourceSlug(source: SourceName): string {
  return source.toLowerCase();
}

function postedAtFor(dayOffset: number, seed: number): Date {
  return new Date(Date.UTC(2026, 0, 1 + dayOffset, 7 + (seed % 10), (seed * 13) % 60, 0));
}

function postedTextFor(postedAt: Date): string {
  const diffMs = Math.max(0, REFERENCE_NOW.getTime() - postedAt.getTime());
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours <= 24) {
    return `${Math.max(1, diffHours)} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 1) {
    return '1 day ago';
  }

  return `${diffDays} days ago`;
}

function workModeTextFor(locationText: string, seed: number): string {
  const lower = locationText.toLowerCase();
  if (lower.includes('remote')) {
    return 'Remote';
  }

  if (lower.includes('hybrid')) {
    return 'Hybrid';
  }

  return seed % 3 === 0 ? 'On-site' : 'Hybrid';
}

function descriptionFor(title: string, seed: number): string {
  const focus = FOCUS_AREAS[seed % FOCUS_AREAS.length];
  const skills = SKILL_BUNDLES[seed % SKILL_BUNDLES.length].join(', ');
  const authorizationLine =
    seed % 7 === 0
      ? 'Right to work in Ireland required; visa sponsorship is not available.'
      : 'Experience working with cross-functional stakeholders in Ireland-based teams is preferred.';

  if (STRETCH_MOCK_TITLES.has(title)) {
    return `${title} role with light engineering and strong analytics delivery. Build dashboards and reporting layers using ${skills}. Focus on KPI reporting, stakeholder reporting, and trend analysis. ${authorizationLine}`;
  }

  return `Analytics-focused ${title} role centered on ${focus}. Use ${skills} to deliver insights, dashboards, and ad hoc analysis for business teams. Strong emphasis on reporting cadence, visualization quality, and clear stakeholder communication. ${authorizationLine}`;
}

function pickTitle(seed: number, dayOffset: number, variant: number): string {
  const base = ANALYTICS_TITLES[(seed + variant) % ANALYTICS_TITLES.length];
  const isStretch = STRETCH_MOCK_TITLES.has(base);
  if (!isStretch) {
    return base;
  }

  const allowStretch = (seed + dayOffset + variant) % 9 === 0;
  if (allowStretch) {
    return base;
  }

  for (let offset = 1; offset < ANALYTICS_TITLES.length; offset += 1) {
    const candidate = ANALYTICS_TITLES[(seed + variant + offset) % ANALYTICS_TITLES.length];
    if (!STRETCH_MOCK_TITLES.has(candidate)) {
      return candidate;
    }
  }

  return base;
}

function buildMockJob(seed: number, dayOffset: number, variant = 0): RawProviderJob {
  const provider = PROVIDERS[(seed + variant) % PROVIDERS.length];
  const title = pickTitle(seed, dayOffset, variant);
  const company = COMPANIES[(seed * 3 + variant) % COMPANIES.length];
  const locationText = LOCATIONS[(seed * 5 + variant) % LOCATIONS.length];
  const postedAt = postedAtFor(dayOffset, seed + variant * 11);
  const slug = sourceSlug(provider);
  const providerJobId = `${slug}-${dayOffset}-${seed}-${variant}`;

  return {
    provider,
    providerJobId,
    title,
    company,
    locationText,
    postedAt,
    postedText: postedTextFor(postedAt),
    sourceUrl: `https://example.com/${slug}/${providerJobId}`,
    applyUrl: `https://example.com/${slug}/${providerJobId}/apply`,
    description: descriptionFor(title, seed + variant * 7),
    workModeText: workModeTextFor(locationText, seed + variant),
    employmentTypeText: seed % 5 === 0 ? 'Contract' : 'Full-time',
    salaryText: SALARY_BANDS[seed % SALARY_BANDS.length],
    rawPayload: {
      generated: true,
      seed,
      dayOffset,
      variant
    }
  };
}

const generatedJobs: RawProviderJob[] = [];

for (let dayOffset = 0; dayOffset <= DAYS_FROM_JAN_1_TO_MAR_17; dayOffset += 1) {
  const dailyVariants = dayOffset < 10 ? 4 : dayOffset < 30 ? 6 : 8;
  for (let variant = 0; variant < dailyVariants; variant += 1) {
    const seed = dayOffset + 1 + variant * 1500;
    generatedJobs.push(buildMockJob(seed, dayOffset, variant));
  }
}

const duplicateJobs: RawProviderJob[] = generatedJobs.slice(0, 120).map((job, idx) => {
  const currentProviderIndex = PROVIDERS.indexOf(job.provider);
  const provider = PROVIDERS[(currentProviderIndex + 1) % PROVIDERS.length];
  const slug = sourceSlug(provider);
  const providerJobId = `${slug}-dup-${idx + 1}`;

  return {
    ...job,
    provider,
    providerJobId,
    sourceUrl: `https://example.com/${slug}/${providerJobId}`,
    applyUrl: `https://example.com/${slug}/${providerJobId}/apply`
  };
});

export const MOCK_PROVIDER_JOBS: RawProviderJob[] = [...generatedJobs, ...duplicateJobs].sort(
  (a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0)
);
