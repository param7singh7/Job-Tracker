import { ArrowUpRight } from 'lucide-react';

export function MetricCard({
  title,
  value,
  subtitle,
  emphasize = false
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-card transition ${
        emphasize ? 'border-primary bg-emerald-50/60' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="mono text-[11px] uppercase tracking-wider text-muted">{title}</p>
        <ArrowUpRight className="h-4 w-4 text-zinc-400" />
      </div>
      <p className="mt-3 text-3xl font-bold leading-none text-ink">{value}</p>
      {subtitle ? <p className="mt-2 text-xs text-zinc-600">{subtitle}</p> : null}
    </div>
  );
}
