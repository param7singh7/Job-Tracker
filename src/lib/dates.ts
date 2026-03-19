const DAY_MS = 24 * 60 * 60 * 1000;

export function parsePostedAt(postedText?: string, fallback?: Date): Date | undefined {
  if (!postedText) {
    return fallback;
  }

  const raw = postedText.toLowerCase().trim();
  const now = new Date();

  if (raw.includes('today') || raw.includes('just posted') || raw === 'new') {
    return now;
  }

  if (raw.includes('yesterday')) {
    return new Date(now.getTime() - DAY_MS);
  }

  const dayMatch = raw.match(/(\d+)\s*day/);
  if (dayMatch) {
    return new Date(now.getTime() - Number(dayMatch[1]) * DAY_MS);
  }

  const hourMatch = raw.match(/(\d+)\s*hour/);
  if (hourMatch) {
    return new Date(now.getTime() - Number(hourMatch[1]) * 60 * 60 * 1000);
  }

  const minuteMatch = raw.match(/(\d+)\s*minute/);
  if (minuteMatch) {
    return new Date(now.getTime() - Number(minuteMatch[1]) * 60 * 1000);
  }

  const parsed = new Date(postedText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return fallback;
}

export function ageInHours(date?: Date | null): number {
  if (!date) {
    return 9999;
  }

  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60));
}

export function isToday(date?: Date | null): boolean {
  if (!date) {
    return false;
  }

  const now = new Date();
  return date.toDateString() === now.toDateString();
}
