import { SourceName } from '@prisma/client';
import { JobProviderAdapter } from '@/src/adapters/base';
import { GlassdoorAdapter } from '@/src/adapters/glassdoor';
import { IndeedAdapter } from '@/src/adapters/indeed';
import { IrishJobsAdapter } from '@/src/adapters/irishjobs';
import { JobsIrelandAdapter } from '@/src/adapters/jobsireland';
import { LinkedInAdapter } from '@/src/adapters/linkedin';

const providers: JobProviderAdapter[] = [
  new LinkedInAdapter(),
  new JobsIrelandAdapter(),
  new GlassdoorAdapter(),
  new IrishJobsAdapter(),
  new IndeedAdapter()
];

export function allAdapters(): JobProviderAdapter[] {
  return providers;
}

export function adapterBySource(source: SourceName): JobProviderAdapter | undefined {
  return providers.find((provider) => provider.source === source);
}
