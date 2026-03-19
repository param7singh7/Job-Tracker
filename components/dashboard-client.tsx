'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/badge';
import { MetricCard } from '@/components/metric-card';
import { notifyNewApplyNowJobs } from '@/src/lib/browser-notifications';
import { formatLabel } from '@/src/lib/labels';

interface StatsResponse {
  newToday: number;
  newSinceLastVisit: number;
  totalActiveRelevantJobs: number;
  applyNowCount: number;
  strongMatchesCount: number;
  unreviewedCount: number;
  savedJobs: number;
  appliedJobs: number;
  sourcesScannedSuccessfully: number;
  jobsBySource: Array<{ source: string; count: number }>;
  jobsByLocation: Array<{ location: string; count: number }>;
  jobsByMatchLevel: Array<{ matchLevel: string; count: number }>;
  jobsByMatchBucket: Array<{ matchBucket: string; count: number }>;
  companiesHiringFrequently: Array<{ company: string; rolesOpen: number; lastSeenAt: string | null }>;
  recentlyFailingSources: Array<{ name: string; lastError: string | null }>;
  dailyDigest: {
    highlights: string[];
  };
}

interface JobResponse {
  jobs: Array<{
    id: string;
    title: string;
    companyNameCached: string;
    matchLevel: string;
    cvFitLabel: string;
    cvFitReasons: string[];
    postedAt: string | null;
    userStates: Array<{ reviewedAt: string | null; status: string }>;
  }>;
  cvTargetRoles: string[];
}

function toneByMatch(matchLevel: string): 'APPLY_NOW' | 'HIGH_MATCH' | 'HOT' | 'DEFAULT' {
  if (matchLevel === 'APPLY_NOW') return 'APPLY_NOW';
  if (matchLevel === 'STRONG_MATCH') return 'HIGH_MATCH';
  if (matchLevel === 'GOOD_MATCH') return 'HOT';
  return 'DEFAULT';
}

function toneByCvFit(cvFitLabel: string): 'APPLY_NOW' | 'HIGH_MATCH' | 'HOT' | 'DEFAULT' {
  if (cvFitLabel === 'CV_MATCH') return 'APPLY_NOW';
  if (cvFitLabel === 'GOOD_MATCH') return 'HIGH_MATCH';
  if (cvFitLabel === 'LESS_MATCH') return 'HOT';
  return 'DEFAULT';
}

export function DashboardClient() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [jobs, setJobs] = useState<JobResponse['jobs']>([]);
  const [cvTargetRoles, setCvTargetRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [statsRes, jobsRes] = await Promise.all([
          fetch('/api/stats', { cache: 'no-store' }),
          fetch('/api/jobs?dateRange=last7&pageSize=500', { cache: 'no-store' })
        ]);

        const statsJson: StatsResponse = await statsRes.json();
        const jobsJson: JobResponse = await jobsRes.json();

        setStats(statsJson);
        setJobs(jobsJson.jobs ?? []);
        setCvTargetRoles(jobsJson.cvTargetRoles ?? []);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    void notifyNewApplyNowJobs(jobs);
  }, [jobs]);

  const sections = useMemo(() => {
    const newToday = jobs.filter((job) => {
      if (!job.postedAt) return false;
      const date = new Date(job.postedAt);
      const now = new Date();
      return date.toDateString() === now.toDateString();
    });

    const applyNow = jobs.filter((job) => job.matchLevel === 'APPLY_NOW').slice(0, 10);
    const strong = jobs.filter((job) => job.matchLevel === 'STRONG_MATCH').slice(0, 10);
    const unreviewed = jobs.filter((job) => !job.userStates?.[0]?.reviewedAt).slice(0, 10);

    return {
      newToday,
      applyNow,
      strong,
      unreviewed
    };
  }, [jobs]);

  const glassdoorCount = stats?.jobsBySource.find((row) => row.source === 'GLASSDOOR')?.count ?? 0;
  const glassdoorFailure = stats?.recentlyFailingSources.find((source) => source.name === 'GLASSDOOR');
  const showGlassdoorWarning = Boolean(glassdoorFailure) || (!!stats && glassdoorCount === 0);

  if (loading || !stats) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-card">
        <p className="mono text-xs text-muted">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="New Today" value={stats.newToday} emphasize />
        <MetricCard title="Total Relevant Jobs" value={stats.totalActiveRelevantJobs} />
        <MetricCard title="Apply Now" value={stats.applyNowCount} emphasize />
        <MetricCard title="Unreviewed" value={stats.unreviewedCount} />
        <MetricCard title="Strong Matches" value={stats.strongMatchesCount} />
        <MetricCard title="New Since Last Visit" value={stats.newSinceLastVisit} emphasize />
        <MetricCard title="Saved" value={stats.savedJobs ?? 0} />
        <MetricCard title="Sources Healthy" value={stats.sourcesScannedSuccessfully} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
          <h2 className="text-base font-semibold">Daily Action Queue</h2>
          <p className="text-xs text-zinc-600">Act on highest-odds opportunities first.</p>

          <div className="mt-4 space-y-4">
            <QueueList title="Apply Now" items={sections.applyNow} />
            <QueueList title="Strong Matches" items={sections.strong} />
            <QueueList title="Unreviewed Jobs" items={sections.unreviewed} />
          </div>
        </div>

        <div className="space-y-4">
          {showGlassdoorWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-card">
              <h2 className="text-base font-semibold text-amber-900">Glassdoor Coverage Warning</h2>
              <p className="mt-1 text-xs text-amber-900">
                {glassdoorFailure
                  ? `Glassdoor is currently failing: ${glassdoorFailure.lastError ?? 'Unknown error'}`
                  : 'Glassdoor returned zero jobs in the latest checks.'}
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="text-base font-semibold">Digest Highlights</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              {stats.dailyDigest.highlights.map((highlight) => (
                <li key={highlight}>• {highlight}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="text-base font-semibold">Jobs by Source</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.jobsBySource.map((row) => (
                <Badge key={row.source} label={`${formatLabel(row.source)} ${row.count}`} />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="text-base font-semibold">CV Match Buckets</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.jobsByMatchBucket.map((row) => (
                <Badge
                  key={row.matchBucket}
                  label={`${formatLabel(row.matchBucket)} ${row.count}`}
                  tone={toneByCvFit(row.matchBucket)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="text-base font-semibold">CV Target Roles</h2>
            <p className="mt-1 text-xs text-zinc-600">Role tracks based on your profile and work history.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {cvTargetRoles.slice(0, 20).map((role) => (
                <Badge key={role} label={role} tone="HIGH_MATCH" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="text-base font-semibold">Frequent Hiring Companies</h2>
            {stats.companiesHiringFrequently.length ? (
              <ul className="mt-2 space-y-2 text-xs text-zinc-700">
                {stats.companiesHiringFrequently.map((company) => (
                  <li key={company.company} className="rounded border border-zinc-200 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <strong>{company.company}</strong>
                      <span className="mono text-[11px]">{company.rolesOpen} roles</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-600">No repeat hiring patterns detected yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
            <h2 className="text-base font-semibold">Recently Failing Sources</h2>
            {stats.recentlyFailingSources.length ? (
              <ul className="mt-2 space-y-2 text-xs text-zinc-700">
                {stats.recentlyFailingSources.map((source) => (
                  <li key={source.name} className="rounded border border-red-200 bg-red-50 p-2">
                    <strong>{source.name}</strong>
                    <p>{source.lastError ?? 'Unknown error'}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-600">No failing sources in latest checks.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Newest Relevant Jobs</h2>
          <Link href="/jobs" className="text-sm font-semibold text-primary hover:underline">
            Open full board
          </Link>
        </div>

        <div className="mt-3 space-y-2">
          {sections.newToday.slice(0, 10).map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-200 p-3 hover:bg-zinc-50"
              >
              <div>
                <p className="font-semibold text-ink">{job.title}</p>
                <p className="text-xs text-zinc-600">{job.companyNameCached}</p>
                <p className="text-[11px] text-zinc-500">{job.cvFitReasons?.[0] ?? 'General analytics fit'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge label={formatLabel(job.matchLevel)} tone={toneByMatch(job.matchLevel)} />
                <Badge label={formatLabel(job.cvFitLabel)} tone={toneByCvFit(job.cvFitLabel)} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function QueueList({ title, items }: { title: string; items: JobResponse['jobs'] }) {
  return (
    <div>
      <p className="mono text-[11px] uppercase tracking-widest text-zinc-500">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/jobs/${item.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
              >
                <span className="text-sm font-medium">{item.title}</span>
                <Badge label={formatLabel(item.matchLevel)} tone={toneByMatch(item.matchLevel)} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-600">No jobs in this section.</p>
      )}
    </div>
  );
}
