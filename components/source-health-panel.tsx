import { Badge } from '@/components/badge';
import { formatLabel } from '@/src/lib/labels';

export interface SourceHealthItem {
  source: string;
  health: string;
  enabled: boolean;
  lastSuccessfulScan: string | null;
  lastScanAttemptAt: string | null;
  lastError: string | null;
  latestResult: {
    status: string;
    fetchedCount: number;
    parsedCount: number;
    duplicateCount: number;
    errorCount: number;
    durationMs: number | null;
  } | null;
}

function tone(health: string): 'HIGH_MATCH' | 'HOT' | 'DEFAULT' {
  if (health === 'HEALTHY') {
    return 'HIGH_MATCH';
  }
  if (health === 'DEGRADED') {
    return 'HOT';
  }
  return 'DEFAULT';
}

export function SourceHealthPanel({ items }: { items: SourceHealthItem[] }) {
  return (
    <section className="space-y-3">
      {items.map((source) => (
        <article key={source.source} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">{formatLabel(source.source)}</h3>
              <p className="mono text-xs text-muted">Last successful scan: {source.lastSuccessfulScan ?? 'Never'}</p>
            </div>
            <Badge label={formatLabel(source.health)} tone={tone(source.health)} />
          </div>

          {source.latestResult ? (
            <div className="mt-3 grid gap-2 text-xs text-zinc-700 sm:grid-cols-4">
              <div>Fetched: {source.latestResult.fetchedCount}</div>
              <div>Parsed: {source.latestResult.parsedCount}</div>
              <div>Duplicates: {source.latestResult.duplicateCount}</div>
              <div>Errors: {source.latestResult.errorCount}</div>
            </div>
          ) : null}

          {source.lastError ? <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{source.lastError}</p> : null}
        </article>
      ))}
    </section>
  );
}
