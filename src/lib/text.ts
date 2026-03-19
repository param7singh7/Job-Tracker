export function normalizeText(value: string | undefined | null): string {
  if (!value) {
    return '';
  }

  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactText(value: string | undefined | null): string {
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}

export function hashableKey(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join('|');
}

export function tokens(value: string): string[] {
  return normalizeText(value).split(' ').filter(Boolean);
}

export function includesAny(haystack: string, needles: readonly string[]): string[] {
  const normalized = normalizeText(haystack);
  return needles.filter((needle) => normalized.includes(normalizeText(needle)));
}
