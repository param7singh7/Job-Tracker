import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Classification, MatchLevel } from '@prisma/client';
import { env } from '@/src/lib/env';
import { prisma } from '@/src/lib/prisma';
import { DedupeGroup } from '@/src/services/deduplication-engine';

interface CsvRow {
  postedAt: string;
  discoveredAt: string;
  title: string;
  company: string;
  location: string;
  source: string;
  matchLevel: string;
  finalScore: string;
  applyUrl: string;
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: CsvRow[]): string {
  const header = [
    'posted_at',
    'discovered_at',
    'title',
    'company',
    'location',
    'source',
    'match_level',
    'final_score',
    'apply_url'
  ];
  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.postedAt,
        row.discoveredAt,
        row.title,
        row.company,
        row.location,
        row.source,
        row.matchLevel,
        row.finalScore,
        row.applyUrl
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  return `${lines.join('\n')}\n`;
}

async function writeCsv(scanRunId: string, rows: CsvRow[]): Promise<{ path: string; rowCount: number }> {
  const exportDir = resolve(process.cwd(), env.csvExportDir);
  await mkdir(exportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `priority-jobs-${scanRunId}-${timestamp}.csv`;
  const fullPath = join(exportDir, filename);
  const latestPath = join(exportDir, 'priority-jobs-latest.csv');
  const csv = toCsv(rows);

  await writeFile(fullPath, csv, 'utf8');
  await writeFile(latestPath, csv, 'utf8');

  return {
    path: fullPath,
    rowCount: rows.length
  };
}

export async function exportPriorityCsvFromDatabase(input: {
  scanRunId: string;
}): Promise<{ path: string; rowCount: number }> {
  const jobs = await prisma.job.findMany({
    where: {
      classification: { not: Classification.EXCLUDED },
      matchLevel: {
        in: [MatchLevel.APPLY_NOW, MatchLevel.STRONG_MATCH]
      }
    },
    orderBy: [{ finalScore: 'desc' }, { postedAt: 'desc' }],
    include: {
      jobSources: {
        select: {
          sourceName: true,
          applyUrl: true,
          sourceUrl: true
        }
      }
    },
    take: 2000
  });

  const rows: CsvRow[] = jobs.map((job) => ({
    postedAt: job.postedAt?.toISOString() ?? '',
    discoveredAt: job.discoveredAt.toISOString(),
    title: job.title,
    company: job.companyNameCached,
    location: job.city ?? job.locationText ?? job.country ?? '',
    source: job.sourcePrimary,
    matchLevel: job.matchLevel,
    finalScore: String(job.finalScore ?? 0),
    applyUrl: job.applyUrl ?? job.jobSources.find((source) => source.applyUrl)?.applyUrl ?? job.jobSources[0]?.sourceUrl ?? ''
  }));

  return writeCsv(input.scanRunId, rows);
}

export async function exportPriorityCsvFromGroups(input: {
  scanRunId: string;
  groups: DedupeGroup[];
}): Promise<{ path: string; rowCount: number }> {
  const rows: CsvRow[] = input.groups
    .map((group) => group.canonical)
    .filter(
      (job) =>
        job.score.classification !== Classification.EXCLUDED &&
        (job.score.match_level === MatchLevel.APPLY_NOW || job.score.match_level === MatchLevel.STRONG_MATCH)
    )
    .sort((a, b) => (b.score.final_score ?? 0) - (a.score.final_score ?? 0))
    .map((job) => ({
      postedAt: job.postedAt?.toISOString() ?? '',
      discoveredAt: job.discoveredAt.toISOString(),
      title: job.title,
      company: job.companyName,
      location: job.city ?? job.locationText ?? job.country ?? '',
      source: job.sourcePrimary,
      matchLevel: job.score.match_level,
      finalScore: String(job.score.final_score ?? 0),
      applyUrl: job.applyUrl ?? job.sourceUrl ?? ''
    }));

  return writeCsv(input.scanRunId, rows);
}
