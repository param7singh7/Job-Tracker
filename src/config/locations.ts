const IRELAND_LOCATIONS = [
  'dublin',
  'cork',
  'galway',
  'limerick',
  'waterford',
  'kilkenny',
  'wexford',
  'meath',
  'kildare',
  'wicklow',
  'clare',
  'mayo',
  'sligo',
  'donegal',
  'tipperary',
  'kerry',
  'laois',
  'offaly',
  'cavan',
  'monaghan',
  'ireland'
];

const REMOTE_PATTERNS = ['remote - ireland', 'remote ireland', 'hybrid - ireland', 'hybrid ireland'];

export function locationLooksIrish(locationText?: string): boolean {
  if (!locationText) {
    return false;
  }

  const normalized = locationText.toLowerCase();
  return (
    IRELAND_LOCATIONS.some((token) => normalized.includes(token)) ||
    REMOTE_PATTERNS.some((token) => normalized.includes(token))
  );
}

export function normalizeIrishLocation(locationText?: string): {
  city?: string;
  county?: string;
  country?: string;
} {
  if (!locationText) {
    return {};
  }

  const normalized = locationText.toLowerCase();
  const country = normalized.includes('ireland') ? 'Ireland' : undefined;

  const cityMatch = IRELAND_LOCATIONS.find((token) => normalized.includes(token) && token !== 'ireland');

  if (!cityMatch) {
    return { country };
  }

  const city = cityMatch.charAt(0).toUpperCase() + cityMatch.slice(1);
  return {
    city,
    county: city,
    country: country ?? 'Ireland'
  };
}
