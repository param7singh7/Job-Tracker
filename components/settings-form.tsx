'use client';

import { useMemo, useState } from 'react';

interface SettingsPayload {
  includedSources: string[];
  keywordGroups: string[];
  excludedKeywordGroups: string[];
  locationFilters: string[];
  minimumScore: number;
  applyNowThreshold: number;
  includeStretchRoles: boolean;
  includeContractJobs: boolean;
  includeGraduateRoles: boolean;
  includeRemoteIreland: boolean;
  includeSuspiciousMatches: boolean;
  refreshFrequencyMinutes: number;
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function SettingsForm({ initial }: { initial: SettingsPayload }) {
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState(initial);

  const sourceList = useMemo(() => state.includedSources.join('\n'), [state.includedSources]);
  const keywordList = useMemo(() => state.keywordGroups.join('\n'), [state.keywordGroups]);
  const excludedList = useMemo(() => state.excludedKeywordGroups.join('\n'), [state.excludedKeywordGroups]);
  const locationList = useMemo(() => state.locationFilters.join('\n'), [state.locationFilters]);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(state)
      });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-card">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mono text-xs uppercase tracking-widest text-muted">Included Sources</label>
          <textarea
            className="mt-1 h-36 w-full rounded-md border border-zinc-300 p-2 text-sm"
            value={sourceList}
            readOnly
          />
          <p className="mt-1 text-[11px] text-zinc-500">Locked to LinkedIn, Indeed, and Glassdoor.</p>
        </div>

        <div>
          <label className="mono text-xs uppercase tracking-widest text-muted">Location Filters</label>
          <textarea
            className="mt-1 h-36 w-full rounded-md border border-zinc-300 p-2 text-sm"
            value={locationList}
            onChange={(e) => setState((prev) => ({ ...prev, locationFilters: parseLines(e.target.value) }))}
          />
        </div>

        <div>
          <label className="mono text-xs uppercase tracking-widest text-muted">Role Keyword Groups</label>
          <textarea
            className="mt-1 h-56 w-full rounded-md border border-zinc-300 p-2 text-sm"
            value={keywordList}
            onChange={(e) => setState((prev) => ({ ...prev, keywordGroups: parseLines(e.target.value) }))}
          />
        </div>

        <div>
          <label className="mono text-xs uppercase tracking-widest text-muted">Excluded Keyword Groups</label>
          <textarea
            className="mt-1 h-56 w-full rounded-md border border-zinc-300 p-2 text-sm"
            value={excludedList}
            onChange={(e) => setState((prev) => ({ ...prev, excludedKeywordGroups: parseLines(e.target.value) }))}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-zinc-700">
          Minimum Score
          <input
            type="number"
            min={0}
            max={100}
            value={state.minimumScore}
            onChange={(e) => setState((prev) => ({ ...prev, minimumScore: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>

        <label className="text-xs font-semibold text-zinc-700">
          Apply Now Threshold
          <input
            type="number"
            min={0}
            max={100}
            value={state.applyNowThreshold}
            onChange={(e) => setState((prev) => ({ ...prev, applyNowThreshold: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>

        <label className="text-xs font-semibold text-zinc-700">
          Refresh Frequency (minutes)
          <input
            type="number"
            min={15}
            max={1440}
            value={state.refreshFrequencyMinutes}
            onChange={(e) => setState((prev) => ({ ...prev, refreshFrequencyMinutes: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-xs font-semibold text-zinc-700">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.includeStretchRoles}
            onChange={(e) => setState((prev) => ({ ...prev, includeStretchRoles: e.target.checked }))}
          />
          Include stretch roles
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.includeContractJobs}
            onChange={(e) => setState((prev) => ({ ...prev, includeContractJobs: e.target.checked }))}
          />
          Include contract roles
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.includeGraduateRoles}
            onChange={(e) => setState((prev) => ({ ...prev, includeGraduateRoles: e.target.checked }))}
          />
          Include graduate roles
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.includeRemoteIreland}
            onChange={(e) => setState((prev) => ({ ...prev, includeRemoteIreland: e.target.checked }))}
          />
          Include remote Ireland
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.includeSuspiciousMatches}
            onChange={(e) => setState((prev) => ({ ...prev, includeSuspiciousMatches: e.target.checked }))}
          />
          Surface suspicious matches
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
