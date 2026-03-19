import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToTrackerButton } from '@/components/add-to-tracker-button';
import { Badge } from '@/components/badge';
import { PotentialCvCard } from '@/components/potential-cv-card';
import { getJobById } from '@/src/services/job-service';
import { getCvFitForJob } from '@/src/services/cv-fit-service';
import { buildPotentialCvDraft } from '@/src/services/cv-tailor-service';
import { formatLabel } from '@/src/lib/labels';

export const dynamic = 'force-dynamic';

interface JobDetailProps {
  params: {
    id: string;
  };
}

function tone(matchLevel: string): 'APPLY_NOW' | 'HIGH_MATCH' | 'HOT' | 'DEFAULT' {
  if (matchLevel === 'APPLY_NOW') return 'APPLY_NOW';
  if (matchLevel === 'STRONG_MATCH') return 'HIGH_MATCH';
  if (matchLevel === 'GOOD_MATCH') return 'HOT';
  return 'DEFAULT';
}

export default async function JobDetailPage({ params }: JobDetailProps) {
  const job = await getJobById(params.id);

  if (!job) {
    notFound();
  }

  const reasons = (job.scoringReasonsJson as string[] | null) ?? [];
  const skills = (job.extractedSkillsJson as string[] | null) ?? [];
  const matched = (job.matchedKeywordsJson as string[] | null) ?? [];
  const excluded = (job.excludedKeywordsJson as string[] | null) ?? [];
  const cvFit = getCvFitForJob({
    title: job.title,
    description: job.descriptionClean ?? job.descriptionRaw,
    extractedSkills: skills,
    seniorityLevel: job.seniorityLevel
  });
  const potentialCv = buildPotentialCvDraft({
    title: job.title,
    companyName: job.companyNameCached,
    locationText: job.locationText ?? [job.city, job.county, job.country].filter(Boolean).join(', '),
    description: job.descriptionClean ?? job.descriptionRaw,
    extractedSkills: skills,
    seniorityLevel: job.seniorityLevel
  });

  return (
    <div className="space-y-4 fade-up">
      <Link href="/jobs" className="text-sm font-semibold text-primary hover:underline">
        ← Back to jobs
      </Link>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{job.title}</h1>
            <p className="text-sm text-zinc-700">{job.companyNameCached}</p>
            <p className="mt-1 text-xs text-zinc-600">
              {job.locationText ?? [job.city, job.county, job.country].filter(Boolean).join(', ')} • {formatLabel(job.workMode)}
            </p>
          </div>

          <div className="text-right">
            <Badge label={formatLabel(job.matchLevel)} tone={tone(job.matchLevel)} />
            <p className="mono mt-2 text-xs text-zinc-600">
              CV Fit {formatLabel(cvFit.label)} ({Math.round(cvFit.score)}/100)
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {job.applyUrl ? (
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-primary bg-emerald-50 px-3 py-1 text-xs font-semibold text-primary hover:opacity-90"
            >
              Open Primary Job Link
            </a>
          ) : null}
          {job.jobSources.map((source) => (
            <a
              key={`${source.sourceName}-${source.sourceUrl}`}
              href={source.applyUrl ?? source.sourceUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-primary hover:text-primary"
            >
              {formatLabel(source.sourceName)}
            </a>
          ))}
        </div>

        <div className="mt-4 border-t border-zinc-200 pt-4">
          <AddToTrackerButton jobId={job.id} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
          <h2 className="text-base font-semibold">Why This Matched Your CV</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {cvFit.reasons.map((reason) => (
              <li key={`cv-${reason}`}>• {reason}</li>
            ))}
            <li>• CV Match Bucket: {formatLabel(cvFit.label)}</li>
            <li>• CV Fit Score: {Math.round(cvFit.score)}/100</li>
            {reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
            <li>• Posted date: {job.postedAt?.toLocaleDateString('en-IE') ?? 'Unknown'}</li>
            <li>• Ireland location: {job.country === 'Ireland' ? 'Confirmed' : 'Likely'}</li>
            <li>• Seniority fit: {formatLabel(job.seniorityLevel)}</li>
          </ul>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
          <h2 className="text-base font-semibold">Skills and Eligibility</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge key={skill} label={skill} tone="HIGH_MATCH" />
            ))}
          </div>

          <p className="mt-3 text-xs text-zinc-700">
            Sponsorship Mentioned: <strong>{job.sponsorshipMentioned ? 'Yes' : 'No'}</strong>
          </p>
          <p className="text-xs text-zinc-700">
            Work Authorization Mentioned: <strong>{job.workAuthorizationMentioned ? 'Yes' : 'No'}</strong>
          </p>

          {matched.length ? (
            <p className="mt-3 text-xs text-zinc-700">Matched keywords: {matched.join(', ')}</p>
          ) : null}
          {excluded.length ? (
            <p className="mt-1 text-xs text-red-700">Excluded signals: {excluded.join(', ')}</p>
          ) : null}
        </article>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
        <h2 className="text-base font-semibold">Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
          {job.descriptionClean ?? job.descriptionRaw ?? 'No description captured.'}
        </p>
      </section>

      <PotentialCvCard text={potentialCv.text} />
    </div>
  );
}
