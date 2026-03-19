import { SourceHealthPanel } from '@/components/source-health-panel';
import { getLatestScanSummary } from '@/src/services/scan-service';
import { getSourceHealth } from '@/src/services/source-health-service';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const [sources, latestRun] = await Promise.all([getSourceHealth(), getLatestScanSummary()]);

  const mapped = sources.map((source) => ({
    source: source.source,
    health: source.health,
    enabled: source.enabled,
    lastSuccessfulScan: source.lastSuccessfulScan?.toISOString() ?? null,
    lastScanAttemptAt: source.lastScanAttemptAt?.toISOString() ?? null,
    lastError: source.lastError,
    latestResult: source.latestResult
      ? {
          ...source.latestResult,
          durationMs: source.latestResult.durationMs ?? null
        }
      : null
  }));

  return (
    <div className="space-y-4 fade-up">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Source Health and Scan Logs</h1>
      {latestRun ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
          <p className="mono text-xs text-muted">Latest Scan Run ID: {latestRun.id}</p>
          <p className="text-sm text-zinc-700">
            Fetched {latestRun.totalFetched} • Created {latestRun.totalCreated} • Updated {latestRun.totalUpdated} •
            Duplicates {latestRun.totalDuplicates}
          </p>
        </div>
      ) : null}
      <SourceHealthPanel items={mapped} />
    </div>
  );
}
