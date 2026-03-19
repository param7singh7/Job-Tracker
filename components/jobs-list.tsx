'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AddToTrackerButton } from '@/components/add-to-tracker-button';
import { Badge } from '@/components/badge';
import { formatLabel } from '@/src/lib/labels';

export interface JobListItem {
  id: string;
  postedAt: string | null;
  discoveredAt: string;
  title: string;
  companyNameCached: string;
  city: string | null;
  county: string | null;
  locationText: string | null;
  workMode: string;
  repostMentioned: boolean;
  matchLevel: string;
  cvFitLabel: string;
  cvFitScore: number;
  cvFitSummary: string;
  userStatus: string;
  sources: string[];
  openUrl: string | null;
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDate(value: string | null): string {
  if (!value) {
    return 'Unknown';
  }

  return new Date(value).toLocaleDateString('en-IE', {
    day: '2-digit',
    month: 'short'
  });
}

function dayKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayKeyFromIso(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return dayKeyFromDate(date);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function matchTone(matchLevel: string): 'APPLY_NOW' | 'HIGH_MATCH' | 'HOT' | 'DEFAULT' {
  if (matchLevel === 'APPLY_NOW') {
    return 'APPLY_NOW';
  }
  if (matchLevel === 'STRONG_MATCH') {
    return 'HIGH_MATCH';
  }
  if (matchLevel === 'GOOD_MATCH') {
    return 'HOT';
  }
  return 'DEFAULT';
}

function cvTone(cvFitLabel: string): 'APPLY_NOW' | 'HIGH_MATCH' | 'HOT' | 'DEFAULT' {
  if (cvFitLabel === 'CV_MATCH') {
    return 'APPLY_NOW';
  }
  if (cvFitLabel === 'GOOD_MATCH') {
    return 'HIGH_MATCH';
  }
  if (cvFitLabel === 'LESS_MATCH') {
    return 'HOT';
  }
  return 'DEFAULT';
}

function prettyCvFit(cvFitLabel: string): string {
  return cvFitLabel.replace(/_/g, ' ');
}

export function JobsList({ jobs }: { jobs: JobListItem[] }) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const latestPostedDate = useMemo(() => {
    const firstWithDate = jobs.find((job) => job.postedAt);
    return firstWithDate?.postedAt ? new Date(firstWithDate.postedAt) : new Date();
  }, [jobs]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(latestPostedDate));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const jobsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const key = dayKeyFromIso(job.postedAt);
      if (!key) {
        continue;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [jobs]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const firstWeekday = (monthStart.getDay() + 6) % 7;
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const cells: Array<{ key: string; day: number | null; count: number }> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ key: `pad-${i}`, day: null, count: 0 });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dayKeyFromDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
      cells.push({ key, day, count: jobsByDay.get(key) ?? 0 });
    }

    return cells;
  }, [calendarMonth, jobsByDay]);

  const sorted = useMemo(
    () => [...jobs].sort((a, b) => new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime()),
    [jobs]
  );

  const filtered = useMemo(() => {
    if (!selectedDay) {
      return sorted;
    }

    return sorted.filter((job) => dayKeyFromIso(job.postedAt) === selectedDay);
  }, [selectedDay, sorted]);

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Jobs by Day</p>
            <p className="text-xs text-zinc-600">Click a day to filter the board.</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-primary hover:text-primary"
              onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
            >
              Prev
            </button>
            <p className="mono text-xs uppercase tracking-wider text-zinc-600">{monthLabel(calendarMonth)}</p>
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-primary hover:text-primary"
              onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEK_DAYS.map((day) => (
            <p key={day} className="text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {day}
            </p>
          ))}
          {calendarCells.map((cell) =>
            cell.day === null ? (
              <div key={cell.key} className="h-12 rounded border border-transparent" />
            ) : (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDay(cell.key)}
                className={`h-12 rounded border p-1 text-left text-xs ${
                  selectedDay === cell.key
                    ? 'border-primary bg-emerald-50'
                    : cell.count > 0
                      ? 'border-zinc-300 bg-zinc-50 hover:border-primary'
                      : 'border-zinc-200 bg-white text-zinc-400'
                }`}
              >
                <p className="mono text-[11px]">{cell.day}</p>
                <p className="text-[11px]">{cell.count}</p>
              </button>
            )
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="mono text-xs uppercase tracking-widest text-muted">{filtered.length} jobs shown</p>
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-primary hover:text-primary"
          >
            All Days
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="mono text-xs uppercase tracking-widest text-muted">{jobs.length} jobs loaded</p>
        <div className="inline-flex rounded-md border border-zinc-300 bg-white p-1">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${view === 'table' ? 'bg-ink text-white' : 'text-zinc-700'}`}
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${view === 'cards' ? 'bg-ink text-white' : 'text-zinc-700'}`}
            onClick={() => setView('cards')}
          >
            Cards
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2">Posted</th>
                <th className="px-3 py-2">Discovered</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Sources</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">CV Fit</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Open</th>
                <th className="px-3 py-2">+</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-b border-zinc-100 align-top hover:bg-zinc-50/60">
                  <td className="px-3 py-3 mono text-xs">{formatDate(job.postedAt)}</td>
                  <td className="px-3 py-3 mono text-xs">{formatDate(job.discoveredAt)}</td>
                  <td className="px-3 py-3">
                    <Link href={`/jobs/${job.id}`} className="font-semibold text-ink hover:text-primary">
                      {job.title}
                    </Link>
                    <p className="text-xs text-zinc-600">{job.companyNameCached}</p>
                    {job.repostMentioned ? (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Reposted
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-700">{job.city ?? job.locationText ?? 'Ireland'}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {job.sources.map((source) => (
                        <Badge key={source} label={formatLabel(source)} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge label={formatLabel(job.matchLevel)} tone={matchTone(job.matchLevel)} />
                  </td>
                  <td className="px-3 py-3">
                    <Badge label={prettyCvFit(job.cvFitLabel)} tone={cvTone(job.cvFitLabel)} />
                    <p className="mt-1 text-[11px] text-zinc-600">{job.cvFitSummary}</p>
                    <p className="mono mt-1 text-[11px] text-zinc-500">CV {Math.round(job.cvFitScore)}/100</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-700">{formatLabel(job.userStatus)}</td>
                  <td className="px-3 py-3 text-xs">
                    {job.openUrl ? (
                      <a
                        href={job.openUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-zinc-300 px-2 py-1 font-semibold text-zinc-700 hover:border-primary hover:text-primary"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <AddToTrackerButton jobId={job.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((job) => (
            <article key={job.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <Badge label={formatLabel(job.matchLevel)} tone={matchTone(job.matchLevel)} />
                <Badge label={`CV ${prettyCvFit(job.cvFitLabel)}`} tone={cvTone(job.cvFitLabel)} />
              </div>

              <Link href={`/jobs/${job.id}`} className="mt-3 block text-lg font-semibold hover:text-primary">
                {job.title}
              </Link>
              <p className="text-sm text-zinc-700">{job.companyNameCached}</p>
              {job.repostMentioned ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Reposted</p>
              ) : null}

              <p className="mt-2 text-xs text-zinc-600">
                {job.city ?? job.locationText ?? 'Ireland'} • {formatLabel(job.workMode)}
              </p>
              <p className="mt-1 text-xs text-zinc-600">{job.cvFitSummary}</p>
              <p className="mono text-[11px] text-zinc-500">CV {Math.round(job.cvFitScore)}/100</p>

              <div className="mt-3 flex flex-wrap gap-1">
                {job.sources.map((source) => (
                  <Badge key={source} label={formatLabel(source)} />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3">
                {job.openUrl ? (
                  <a
                    href={job.openUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-primary hover:text-primary"
                  >
                    Open Job
                  </a>
                ) : (
                  <span className="text-xs text-zinc-400">No link</span>
                )}
                <AddToTrackerButton jobId={job.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
