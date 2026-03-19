'use client';

import { useMemo, useState } from 'react';
import { formatLabel } from '@/src/lib/labels';

export interface TrackerJob {
  id: string;
  title: string;
  company: string;
  location: string;
  status: string;
  openUrl: string | null;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'REVIEWING', label: 'Reviewing' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'INTERVIEW', label: 'Interviewing' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Accepted' }
];

function labelForStatus(status: string): string {
  if (status === 'CLOSED') {
    return 'Accepted';
  }

  return formatLabel(status);
}

export function TrackerBoard({ jobs, focusJobId }: { jobs: TrackerJob[]; focusJobId?: string }) {
  const [statusMap, setStatusMap] = useState<Record<string, string>>(
    Object.fromEntries(jobs.map((job) => [job.id, job.status]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!focusJobId) {
      return jobs;
    }

    return [...jobs].sort((a, b) => {
      if (a.id === focusJobId) return -1;
      if (b.id === focusJobId) return 1;
      return 0;
    });
  }, [focusJobId, jobs]);

  async function updateStatus(jobId: string, nextStatus: string) {
    setStatusMap((prev) => ({ ...prev, [jobId]: nextStatus }));
    setSavingId(jobId);
    try {
      await fetch(`/api/jobs/${jobId}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: nextStatus,
          isApplied: nextStatus === 'APPLIED'
        })
      });
    } finally {
      setSavingId(null);
    }
  }

  if (!sorted.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card">
        <p className="text-sm text-zinc-600">No tracked jobs yet. Use the + button in Jobs to add one.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-card">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Open</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => {
            const status = statusMap[job.id] ?? job.status;
            const highlighted = focusJobId === job.id;

            return (
              <tr
                key={job.id}
                className={`border-b border-zinc-100 align-top ${highlighted ? 'bg-emerald-50/50' : 'hover:bg-zinc-50/60'}`}
              >
                <td className="px-3 py-3 font-semibold text-ink">{job.title}</td>
                <td className="px-3 py-3 text-zinc-700">{job.company}</td>
                <td className="px-3 py-3 text-zinc-700">{job.location}</td>
                <td className="px-3 py-3">
                  {job.openUrl ? (
                    <a
                      href={job.openUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-primary hover:text-primary"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400">No link</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <select
                    value={status}
                    onChange={(e) => void updateStatus(job.id, e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {savingId === job.id ? 'Saving...' : `Current: ${labelForStatus(status)}`}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
