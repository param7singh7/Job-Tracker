import { JobStatus } from '@prisma/client';
import { JobListItem, JobsList } from '@/components/jobs-list';
import { queryJobs } from '@/src/services/job-service';
import { getCvFitForJob } from '@/src/services/cv-fit-service';

export const dynamic = 'force-dynamic';

export default async function SavedJobsPage() {
  const result = await queryJobs({ status: JobStatus.SAVED, pageSize: 80, dateRange: 'all' });

  const jobs: JobListItem[] = result.jobs.map((job) => {
    const cvFit = getCvFitForJob({
      title: job.title,
      description: job.descriptionClean ?? job.descriptionRaw,
      extractedSkills: (job.extractedSkillsJson as string[] | null) ?? [],
      seniorityLevel: job.seniorityLevel
    });

    return {
      id: job.id,
      postedAt: job.postedAt?.toISOString() ?? null,
      discoveredAt: job.discoveredAt.toISOString(),
      title: job.title,
      companyNameCached: job.companyNameCached,
      city: job.city,
      county: job.county,
      locationText: job.locationText,
      workMode: job.workMode,
      repostMentioned: (job.descriptionClean ?? job.descriptionRaw ?? '').toLowerCase().includes('reposted'),
      matchLevel: job.matchLevel,
      cvFitLabel: cvFit.label,
      cvFitSummary: cvFit.reasons[0] ?? 'General analytics fit',
      userStatus: job.userStates[0]?.status ?? 'NEW',
      sources: [...new Set(job.jobSources.map((source) => source.sourceName))],
      openUrl: job.applyUrl ?? job.jobSources.find((source) => source.applyUrl)?.applyUrl ?? job.jobSources.find((source) => source.sourceUrl)?.sourceUrl ?? null
    };
  });

  return (
    <div className="space-y-4 fade-up">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Saved Jobs</h1>
      <JobsList jobs={jobs} />
    </div>
  );
}
