import { DashboardClient } from '@/components/dashboard-client';

export default function DashboardPage() {
  return (
    <div className="space-y-4 fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Daily Hiring Radar</h1>
        <p className="text-sm text-zinc-600">
          Open this every day, triage new roles quickly, and move best-fit jobs to applied status.
        </p>
      </div>
      <DashboardClient />
    </div>
  );
}
