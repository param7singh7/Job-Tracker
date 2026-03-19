'use client';

import { ReactNode, useState } from 'react';

export function RefreshScanButton({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    try {
      setLoading(true);
      await fetch('/api/refresh', { method: 'POST' });
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      disabled={loading}
    >
      {loading ? 'Refreshing...' : children}
    </button>
  );
}
