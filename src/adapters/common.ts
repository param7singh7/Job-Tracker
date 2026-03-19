import { SourceName } from '@prisma/client';
import { ProviderFetchResult } from '@/src/types/job';

export function emptyProviderResult(source: SourceName, durationMs = 0): ProviderFetchResult {
  return {
    provider: source,
    jobs: [],
    errors: [],
    warnings: [],
    health: {
      provider: source,
      status: 'healthy'
    },
    durationMs
  };
}

export function disabledProviderResult(source: SourceName, durationMs = 0): ProviderFetchResult {
  return {
    provider: source,
    jobs: [],
    errors: [],
    warnings: ['Provider disabled by configuration'],
    health: {
      provider: source,
      status: 'disabled',
      message: 'Provider disabled'
    },
    durationMs
  };
}
