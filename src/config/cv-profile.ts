export interface CvProfile {
  candidateName: string;
  location: string;
  yearsExperience: number;
  summary: string;
  coreSkills: string[];
  domainSignals: string[];
  recommendedTargetRoles: string[];
  adjacentRoles: string[];
}

export const CV_PROFILE: CvProfile = {
  candidateName: 'Param Preet Singh',
  location: 'Dublin, Ireland',
  yearsExperience: 5,
  summary:
    'Data Analyst with SQL, Power BI, Tableau, Excel, KPI reporting, data quality, stakeholder reporting, and fraud/risk analytics experience.',
  coreSkills: [
    'sql',
    'python',
    'power bi',
    'dax',
    'power query',
    'tableau',
    'excel',
    'kpi reporting',
    'data validation',
    'stakeholder reporting',
    'fraud analysis',
    'operational analytics',
    'data quality'
  ],
  domainSignals: [
    'fraud detection',
    'risk indicators',
    'compliance analytics',
    'operational performance',
    'decision support',
    'financial planning reporting',
    'healthcare',
    'medtech',
    'regulated environment',
    'quality reporting',
    'due diligence'
  ],
  recommendedTargetRoles: [
    'Data Analyst',
    'Business Data Analyst',
    'Reporting Analyst',
    'Data & Insights Analyst',
    'Business Intelligence Analyst',
    'Power BI Analyst',
    'SQL Analyst',
    'Data Quality Analyst',
    'Decision Support Analyst',
    'Business Analyst (data/reporting heavy)',
    'Process Analyst (analytics heavy)',
    'Analytics Consultant',
    'Reporting Consultant',
    'Power BI Developer',
    'BI Developer',
    'SQL Developer (reporting-focused)',
    'Compliance Analyst (reporting-heavy)',
    'Healthcare Data Analyst',
    'Quality Reporting Analyst',
    'Fraud Analyst',
    'Risk Analyst',
    'Operations Analyst',
    'Performance Analyst',
    'Commercial Analyst',
    'Customer Insights Analyst'
  ],
  adjacentRoles: [
    'Product Analyst',
    'Marketing Analyst',
    'Revenue Analyst',
    'Sales Analyst',
    'Workforce Analyst',
    'Supply Chain Analyst',
    'BI Developer (analytics-focused)',
    'Analytics Consultant'
  ]
};
