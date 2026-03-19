'use client';

import { useState } from 'react';

interface PotentialCvCardProps {
  text: string;
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function PotentialCvCard({ text }: PotentialCvCardProps) {
  const [copied, setCopied] = useState(false);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Potential CV (Copy Ready)</h2>
          <p className="text-xs text-zinc-600">Tailored for this job. Copy and paste into your CV draft.</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyText(text);
            setCopied(ok);
            if (ok) {
              setTimeout(() => setCopied(false), 1800);
            }
          }}
          className="rounded-md border border-primary bg-emerald-50 px-3 py-1 text-xs font-semibold text-primary hover:opacity-90"
        >
          {copied ? 'Copied' : 'Copy Potential CV'}
        </button>
      </div>

      <textarea
        className="mono mt-3 h-80 w-full rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs leading-5 text-zinc-800"
        value={text}
        readOnly
        spellCheck={false}
      />
    </section>
  );
}
