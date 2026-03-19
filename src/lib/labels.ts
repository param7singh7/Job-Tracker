const LABEL_OVERRIDES: Record<string, string> = {
  APPLY_NOW: 'Apply Now',
  STRONG_MATCH: 'Strong Match',
  GOOD_MATCH: 'Good Match',
  LOW_MATCH: 'Low Match',
  EXCLUDE: 'Exclude',
  NEW_TODAY: 'New Today',
  NEW_SINCE_LAST_VISIT: 'New Since Last Visit',
  CLOSING_SOON: 'Closing Soon',
  HIGH_MATCH: 'High Match',
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  LINKEDIN: 'LinkedIn',
  JOBSIRELAND: 'JobsIreland',
  GLASSDOOR: 'Glassdoor',
  IRISHJOBS: 'IrishJobs',
  INDEED: 'Indeed',
  CV: 'CV'
};

const ACRONYMS = new Set(['bi', 'mi', 'mis', 'sql', 'kpi', 'api', 'cv']);

function capitalize(word: string): string {
  if (!word) {
    return word;
  }

  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) {
    return lower.toUpperCase();
  }

  if (lower === 'fp&a' || lower === 'fp' || lower === 'fpa') {
    return 'FP&A';
  }

  return `${lower[0].toUpperCase()}${lower.slice(1)}`;
}

export function formatLabel(value: string): string {
  const raw = value?.trim();
  if (!raw) {
    return '';
  }

  if (LABEL_OVERRIDES[raw]) {
    return LABEL_OVERRIDES[raw];
  }

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(capitalize)
    .join(' ');
}
