import { DEFAULT_SEARCH_CONFIG } from '@/src/config/default-search-config';
import { prisma } from '@/src/lib/prisma';
import { SettingsForm } from '@/components/settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let config: Awaited<ReturnType<typeof prisma.searchConfig.findUnique>> = null;
  try {
    config = await prisma.searchConfig.findUnique({ where: { name: 'default' } });
  } catch {
    config = null;
  }

  const payload = {
    includedSources: [...DEFAULT_SEARCH_CONFIG.includedSources] as string[],
    keywordGroups: [...DEFAULT_SEARCH_CONFIG.keywordGroups] as string[],
    excludedKeywordGroups: ((config?.excludedKeywordGroups as string[] | undefined) ??
      DEFAULT_SEARCH_CONFIG.excludedKeywordGroups) as string[],
    locationFilters: ((config?.locationFilters as string[] | undefined) ?? DEFAULT_SEARCH_CONFIG.locationFilters) as string[],
    minimumScore: config?.minimumScore ?? DEFAULT_SEARCH_CONFIG.minimumScore,
    applyNowThreshold: config?.applyNowThreshold ?? DEFAULT_SEARCH_CONFIG.applyNowThreshold,
    includeStretchRoles: config?.includeStretchRoles ?? DEFAULT_SEARCH_CONFIG.includeStretchRoles,
    includeContractJobs: config?.includeContractJobs ?? DEFAULT_SEARCH_CONFIG.includeContractJobs,
    includeGraduateRoles: config?.includeGraduateRoles ?? DEFAULT_SEARCH_CONFIG.includeGraduateRoles,
    includeRemoteIreland: config?.includeRemoteIreland ?? DEFAULT_SEARCH_CONFIG.includeRemoteIreland,
    includeSuspiciousMatches: config?.includeSuspiciousMatches ?? DEFAULT_SEARCH_CONFIG.includeSuspiciousMatches,
    refreshFrequencyMinutes: config?.refreshFrequencyMinutes ?? DEFAULT_SEARCH_CONFIG.refreshFrequencyMinutes
  };

  return (
    <div className="space-y-4 fade-up">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
      <p className="text-sm text-zinc-600">
        Tune thresholds and keywords for your daily 30-day hiring sprint. Source scope is locked to LinkedIn + Glassdoor.
      </p>
      <SettingsForm initial={payload} />
    </div>
  );
}
