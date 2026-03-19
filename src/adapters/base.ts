import { SourceName } from '@prisma/client';
import { ProviderFetchContext, ProviderFetchResult } from '@/src/types/job';

export interface JobProviderAdapter {
  source: SourceName;
  fetch(context: ProviderFetchContext): Promise<ProviderFetchResult>;
}
