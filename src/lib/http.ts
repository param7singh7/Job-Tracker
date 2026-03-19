import { env } from '@/src/lib/env';

export async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const isLinkedIn = /(^https?:\/\/)?([a-z0-9-]+\.)*linkedin\.com/i.test(url);
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has('User-Agent')) {
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
  }

  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-IE,en;q=0.9');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  }

  if (isLinkedIn) {
    if (!headers.has('Referer')) {
      headers.set('Referer', 'https://www.linkedin.com/jobs/');
    }

    if (env.linkedinCookie && !headers.has('Cookie')) {
      const cookie = env.linkedinCookie.trim();
      headers.set('Cookie', cookie.includes('=') ? cookie : `li_at=${cookie}`);
    }
  }

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      ...init,
      headers
    });
  } finally {
    clearTimeout(timeout);
  }
}
