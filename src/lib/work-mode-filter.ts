import { WorkMode } from '@prisma/client';

const EU_REMOTE_TERMS = [' european union', ' europe ', ' eu ', ' emea', ' worldwide', 'global'];

function normalized(value: string | null | undefined): string {
  return ` ${String(value ?? '').toLowerCase()} `;
}

export function isIrelandOnlyRemote(locationText?: string | null, country?: string | null): boolean {
  const location = normalized(locationText);
  const countryNormalized = normalized(country);
  const hasIreland = location.includes(' ireland ') || countryNormalized.includes(' ireland ');

  if (!hasIreland) {
    return false;
  }

  return !EU_REMOTE_TERMS.some((term) => location.includes(term));
}

export function isAllowedWorkMode(
  workMode?: WorkMode | string | null,
  locationText?: string | null,
  country?: string | null
): boolean {
  if (workMode === WorkMode.HYBRID || workMode === WorkMode.ONSITE) {
    return true;
  }

  if (workMode === WorkMode.REMOTE) {
    return isIrelandOnlyRemote(locationText, country);
  }

  return false;
}
