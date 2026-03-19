import { JobStatus } from '@prisma/client';
import { TrackerBoard, TrackerJob } from '@/components/tracker-board';
import { queryJobs } from '@/src/services/job-service';

export const dynamic = 'force-dynamic';

interface TrackerPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function toValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function TrackerPage({ searchParams }: TrackerPageProps) {
  const focusJobId = toValue(searchParams.jobId);
  const statuses: JobStatus[] = [
    JobStatus.REVIEWING,
    JobStatus.APPLIED,
    JobStatus.INTERVIEW,
    JobStatus.REJECTED,
    JobStatus.CLOSED
  ];

  const result = await queryJobs({ pageSize: 500, dateRange: 'last7' });
  const jobs: TrackerJob[] = result.jobs
    .filter((job) => {
      const status = job.userStates[0]?.status ?? JobStatus.NEW;
      return statuses.includes(status);
    })
    .map((job) => ({
      id: job.id,
      title: job.title,
      company: job.companyNameCached,
      location: job.city ?? job.locationText ?? 'Ireland',
      status: job.userStates[0]?.status ?? JobStatus.REVIEWING,
      openUrl:
        job.applyUrl ??
        job.jobSources.find((source) => source.applyUrl)?.applyUrl ??
        job.jobSources.find((source) => source.sourceUrl)?.sourceUrl ??
        null
    }));

  return (
    <div className="space-y-4 fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">CV Tracker</h1>
        <p className="text-sm text-zinc-600">
          Manage your pipeline with quick status updates: Applied, Interviewing, Rejected, Accepted.
        </p>
      </div>
      <TrackerBoard jobs={jobs} focusJobId={focusJobId} />
    </div>
  );
}
