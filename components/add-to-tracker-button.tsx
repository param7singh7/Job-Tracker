'use client';

import { useState } from 'react';

export function AddToTrackerButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);

  async function addToTracker() {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      await fetch(`/api/jobs/${jobId}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'REVIEWING'
        })
      });
      window.location.href = `/tracker?jobId=${encodeURIComponent(jobId)}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void addToTracker()}
      disabled={loading}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-lg font-semibold text-zinc-700 hover:border-primary hover:text-primary"
      aria-label="Add job to tracker"
      title="Add to tracker"
    >
      {loading ? '…' : '+'}
    </button>
  );
}
