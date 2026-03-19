'use client';

import { useState } from 'react';

type ActionKey = 'saved' | 'applied' | 'dismissed' | 'reviewing';

const ACTIONS: Record<ActionKey, { label: string; payload: Record<string, unknown>; className: string }> = {
  saved: {
    label: 'Save',
    payload: { status: 'SAVED', isSaved: true },
    className: 'border-sky-300 bg-sky-50 text-sky-700'
  },
  applied: {
    label: 'Applied',
    payload: { status: 'APPLIED', isApplied: true },
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700'
  },
  dismissed: {
    label: 'Dismiss',
    payload: { status: 'DISMISSED', isDismissed: true },
    className: 'border-zinc-300 bg-zinc-50 text-zinc-700'
  },
  reviewing: {
    label: 'Reviewing',
    payload: { status: 'REVIEWING' },
    className: 'border-amber-300 bg-amber-50 text-amber-700'
  }
};

export function JobActions({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState<ActionKey | null>(null);

  async function run(action: ActionKey) {
    setLoading(action);
    try {
      await fetch(`/api/jobs/${jobId}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ACTIONS[action].payload)
      });
      window.location.reload();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(ACTIONS) as ActionKey[]).map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => run(action)}
          disabled={loading !== null}
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${ACTIONS[action].className}`}
        >
          {loading === action ? '...' : ACTIONS[action].label}
        </button>
      ))}
    </div>
  );
}
