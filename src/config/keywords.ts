function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export const DATA_ANALYTICS_TITLES = [
  'data analyst',
  'business data analyst',
  'reporting analyst',
  'insights analyst',
  'data and insights analyst',
  'data & insights analyst',
  'bi analyst',
  'business intelligence analyst',
  'mi analyst',
  'management information analyst',
  'performance analyst',
  'kpi analyst',
  'metrics analyst',
  'operations analyst',
  'commercial analyst',
  'risk analyst',
  'fraud analyst',
  'data quality analyst',
  'decision support analyst',
  'analytics specialist',
  'reporting specialist',
  'operations insights analyst',
  'operations reporting analyst',
  'stakeholder reporting analyst',
  'junior data analyst',
  'graduate data analyst',
  'data operations analyst'
] as const;

export const BI_REPORTING_TITLES = [
  'power bi analyst',
  'bi developer',
  'power bi developer',
  'reporting developer',
  'reporting consultant',
  'bi consultant',
  'sql reporting analyst',
  'dashboard analyst',
  'reporting and insights analyst',
  'data reporting analyst',
  'business intelligence reporting analyst',
  'analyst data reporting',
  'analyst insights reporting'
] as const;

export const BUSINESS_ANALYST_TITLES = [
  'business analyst',
  'junior business analyst',
  'process analyst',
  'business process analyst',
  'transformation analyst',
  'business systems analyst',
  'functional analyst',
  'systems analyst'
] as const;

export const CONSULTING_ANALYTICS_TITLES = [
  'analytics consultant',
  'associate consultant',
  'functional consultant',
  'business consultant',
  'transformation consultant',
  'power bi consultant',
  'power platform consultant',
  'power apps consultant',
  'power automate consultant',
  'solution analyst',
  'implementation consultant'
] as const;

export const HEALTHCARE_ANALYTICS_TITLES = [
  'healthcare data analyst',
  'medtech analyst',
  'medical device analyst',
  'compliance analyst',
  'quality reporting analyst',
  'operations analyst healthcare',
  'operations analyst medtech',
  'risk reporting analyst',
  'fraud analytics analyst',
  'claims analyst',
  'due diligence analyst'
] as const;

export const LIGHT_DATA_ENGINEERING_TITLES = [
  'sql developer',
  'bi developer',
  'reporting developer',
  'analytics engineer',
  'data engineer',
  'data warehouse developer',
  'data pipeline analyst'
] as const;

export const ELIGIBLE_ROLE_UNIVERSE = unique([
  ...DATA_ANALYTICS_TITLES,
  ...BI_REPORTING_TITLES,
  ...BUSINESS_ANALYST_TITLES,
  ...CONSULTING_ANALYTICS_TITLES,
  ...HEALTHCARE_ANALYTICS_TITLES,
  ...LIGHT_DATA_ENGINEERING_TITLES,
  'analyst',
  'insights specialist',
  'analytics specialist'
]);

export const STRETCH_ROLE_KEYWORDS = [
  'senior data analyst',
  'senior business analyst',
  'lead analyst',
  'principal analyst',
  'manager data analytics',
  'head of analytics',
  'director analytics',
  'analytics engineer',
  'data engineer'
] as const;

export const ANALYTICS_CORE_TERMS = [
  'analytics',
  'analysis',
  'insights',
  'reporting',
  'dashboard',
  'dashboards',
  'kpi',
  'kpis',
  'metrics',
  'business intelligence',
  'data visualization',
  'data visualisation',
  'ad hoc analysis',
  'trend analysis',
  'variance analysis',
  'forecasting',
  'performance reporting',
  'operational reporting',
  'commercial reporting',
  'customer reporting',
  'stakeholder reporting',
  'board reporting',
  'monthly reporting',
  'weekly reporting',
  'executive reporting',
  'management information',
  'management reporting',
  'decision support',
  'data quality',
  'data validation',
  'data reconciliation',
  'reporting automation'
] as const;

export const BI_REPORTING_TERMS = [
  'power bi',
  'dax',
  'power query',
  'tableau',
  'sql reporting',
  'report builder',
  'reporting pack',
  'reporting packs',
  'scorecard',
  'scorecards',
  'dashboard development',
  'reporting solution',
  'business intelligence reporting'
] as const;

export const CONSULTING_ANALYTICS_TERMS = [
  'functional consultant',
  'analytics consultant',
  'reporting consultant',
  'solution design',
  'stakeholder workshops',
  'client-facing',
  'client delivery',
  'implementation',
  'workflow automation',
  'process automation',
  'business process improvement',
  'digital transformation',
  'requirements gathering',
  'business requirements'
] as const;

export const HEALTHCARE_ANALYTICS_TERMS = [
  'healthcare',
  'hospital',
  'medtech',
  'medical device',
  'regulated',
  'compliance',
  'sop',
  'quality systems',
  'compliance reporting',
  'quality reporting',
  'operational performance',
  'performance monitoring',
  'claims',
  'fraud',
  'risk',
  'due diligence',
  'reliability',
  'service performance'
] as const;

export const LIGHT_DATA_ENGINEERING_TERMS = [
  'sql developer',
  'data warehouse',
  'warehouse',
  'etl',
  'elt',
  'data pipeline',
  'pipeline',
  'data mart',
  'reporting pipeline',
  'analytics pipeline'
] as const;

export const DOMAIN_PRIORITY_KEYWORDS = [
  'consulting',
  'consultancy',
  'operations analytics',
  'fraud analysis',
  'risk analysis',
  'due diligence',
  'healthcare',
  'medtech',
  'regulated environment',
  'compliance reporting',
  'quality reporting'
] as const;

export const TOOL_KEYWORDS = [
  'sql',
  't-sql',
  'mysql',
  'postgresql',
  'mssql',
  'excel',
  'advanced excel',
  'pivot tables',
  'vlookup',
  'xlookup',
  'power query',
  'power pivot',
  'power bi',
  'dax',
  'tableau',
  'looker',
  'qlik',
  'ga4',
  'python',
  'pandas',
  'r',
  'sas',
  'spss',
  'alteryx',
  'azure data factory',
  'adf',
  'azure synapse',
  'synapse',
  'azure sql',
  'databricks',
  'data lake',
  'data warehouse',
  'power platform',
  'power apps',
  'power automate',
  'dataverse',
  'dynamics 365',
  'd365'
] as const;

export const BUSINESS_ANALYST_DATA_SIGNALS = [
  'requirements gathering',
  'requirements analysis',
  'stakeholder management',
  'stakeholder engagement',
  'process mapping',
  'business requirements',
  'functional requirements',
  'user stories',
  'acceptance criteria',
  'documentation',
  'process improvement',
  'gap analysis',
  'analytical mindset'
] as const;

export const RESPONSIBILITY_KEYWORDS = [
  'build dashboards',
  'create dashboards',
  'develop reports',
  'automate reporting',
  'kpi reporting',
  'analyse trends',
  'track metrics',
  'data cleansing',
  'data cleaning',
  'data validation',
  'data quality',
  'reconciliation',
  'reporting insights',
  'business performance analysis',
  'root cause analysis',
  'variance reporting',
  'stakeholder insights',
  'visualize data',
  'summarize findings',
  'report automation',
  'decision support',
  'operational performance',
  'compliance reporting',
  'dashboard development',
  'workflow automation',
  'process redesign',
  'client delivery'
] as const;

export const STEALTH_ANALYTICS_SIGNALS = [
  'kpi tracking',
  'business metrics',
  'service metrics',
  'performance metrics',
  'monthly reporting',
  'weekly reporting',
  'operational insights',
  'process reporting',
  'executive reporting',
  'stakeholder reporting',
  'report building',
  'reporting packs',
  'business performance',
  'analytical support'
] as const;

export const SUPPORT_EXCLUDE_KEYWORDS = [
  'it support',
  'technical support',
  'service desk',
  'helpdesk',
  'help desk',
  'desktop support',
  'application support',
  'end user support',
  'first line support',
  '1st line support',
  'second line support',
  '2nd line support'
] as const;

export const SUPPORT_ANALYTICS_BRIDGE_KEYWORDS = [
  'service reporting',
  'support metrics',
  'ticket analytics',
  'incident trends',
  'support dashboard',
  'sla reporting',
  'it reporting',
  'operational insights',
  'power bi',
  'sql',
  'dashboard',
  'reporting'
] as const;

export const RECRUITMENT_SIGNALS = [
  'recruitment',
  'recruiter',
  'talent solutions',
  'staffing',
  'consultancy recruitment',
  'managed services recruitment',
  'client-facing recruitment'
] as const;

export const ROLE_FAMILY_CLUSTERS = {
  DATA_ANALYTICS: [...DATA_ANALYTICS_TITLES, ...ANALYTICS_CORE_TERMS, ...BUSINESS_ANALYST_DATA_SIGNALS],
  BI_REPORTING: [...BI_REPORTING_TITLES, ...BI_REPORTING_TERMS, 'sql', 'power bi', 'tableau', 'dashboard'],
  CONSULTING_ANALYTICS: [...CONSULTING_ANALYTICS_TITLES, ...CONSULTING_ANALYTICS_TERMS],
  HEALTHCARE_ANALYTICS: [...HEALTHCARE_ANALYTICS_TITLES, ...HEALTHCARE_ANALYTICS_TERMS],
  LIGHT_DATA_ENGINEERING: [...LIGHT_DATA_ENGINEERING_TITLES, ...LIGHT_DATA_ENGINEERING_TERMS]
} as const;

export const SEARCH_KEYWORD_GROUPS: string[] = unique([
  ...ELIGIBLE_ROLE_UNIVERSE,
  'data analyst ireland',
  'business analyst sql',
  'power bi reporting',
  'dashboard analytics',
  'reporting and insights',
  'fraud risk analytics',
  'healthcare data analyst',
  'medtech analyst',
  'compliance reporting analyst',
  'sql reporting developer',
  'analytics consultant power bi',
  'functional consultant power platform',
  'operations analytics reporting'
]);

export const TITLE_POSITIVE_KEYWORDS: string[] = unique([
  ...ELIGIBLE_ROLE_UNIVERSE,
  'analyst',
  'analytics',
  'reporting',
  'insights',
  'business intelligence',
  'consultant',
  'decision support',
  'data quality',
  'kpi',
  'metrics'
]);

export const DESCRIPTION_SIGNAL_KEYWORDS: string[] = unique([
  ...ANALYTICS_CORE_TERMS,
  ...BI_REPORTING_TERMS,
  ...CONSULTING_ANALYTICS_TERMS,
  ...HEALTHCARE_ANALYTICS_TERMS,
  ...LIGHT_DATA_ENGINEERING_TERMS,
  ...TOOL_KEYWORDS,
  ...RESPONSIBILITY_KEYWORDS,
  ...BUSINESS_ANALYST_DATA_SIGNALS,
  ...STEALTH_ANALYTICS_SIGNALS,
  ...DOMAIN_PRIORITY_KEYWORDS
]);

export const NEGATIVE_KEYWORDS = [
  ...SUPPORT_EXCLUDE_KEYWORDS,
  'cloud admin',
  'infrastructure engineer',
  'devops',
  'software engineer',
  'backend engineer',
  'platform engineer',
  'site reliability engineer',
  'machine learning engineer',
  'research scientist',
  'advanced data scientist',
  'deep learning',
  'nlp',
  'principal architect',
  'head of',
  'director',
  'data engineer'
] as const;

export const SENIORITY_NEGATIVE_KEYWORDS = [
  'senior',
  'lead',
  'principal',
  'head',
  'director',
  'senior manager',
  'vice president',
  'people leadership',
  '8+ years',
  '10+ years',
  '12+ years'
] as const;

export const POSITIVE_SENIORITY_KEYWORDS = [
  'entry',
  'entry level',
  'junior',
  'graduate',
  'associate',
  'analyst',
  'mid',
  'early career'
] as const;
