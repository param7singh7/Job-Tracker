import { clsx } from 'clsx';

const styles: Record<string, string> = {
  NEW_TODAY: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  NEW_SINCE_LAST_VISIT: 'bg-sky-100 text-sky-700 border-sky-300',
  HOT: 'bg-rose-100 text-rose-700 border-rose-300',
  APPLY_NOW: 'bg-orange-100 text-orange-700 border-orange-300',
  HIGH_MATCH: 'bg-lime-100 text-lime-700 border-lime-300',
  CLOSING_SOON: 'bg-red-100 text-red-700 border-red-300',
  DEFAULT: 'bg-zinc-100 text-zinc-700 border-zinc-300'
};

export function Badge({ label, tone = 'DEFAULT' }: { label: string; tone?: keyof typeof styles }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        styles[tone] ?? styles.DEFAULT
      )}
    >
      {label}
    </span>
  );
}
