import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SourceName } from '@prisma/client';
import { DEFAULT_SEARCH_CONFIG } from '@/src/config/default-search-config';
import { SEARCH_KEYWORD_GROUPS } from '@/src/config/keywords';

function loadEnvFromFile() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFromFile();

async function clearDatabase(prisma: Awaited<ReturnType<typeof loadRuntime>>['prisma']) {
  await prisma.scanRunSourceResult.deleteMany();
  await prisma.scanRun.deleteMany();
  await prisma.jobSkillTag.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.userJobState.deleteMany();
  await prisma.job.deleteMany();
  await prisma.company.deleteMany();
  await prisma.keywordGroup.deleteMany();
  await prisma.searchConfig.deleteMany();
  await prisma.source.deleteMany();
}

async function seedSources(prisma: Awaited<ReturnType<typeof loadRuntime>>['prisma']) {
  const sources = [
    SourceName.LINKEDIN,
    SourceName.JOBSIRELAND,
    SourceName.GLASSDOOR,
    SourceName.IRISHJOBS,
    SourceName.INDEED
  ];

  for (const sourceName of sources) {
    await prisma.source.create({
      data: {
        name: sourceName,
        enabled: true,
        mockMode: true
      }
    });
  }
}

async function seedSearchConfig(prisma: Awaited<ReturnType<typeof loadRuntime>>['prisma']) {
  await prisma.searchConfig.create({
    data: {
      name: 'default',
      includedSources: DEFAULT_SEARCH_CONFIG.includedSources,
      keywordGroups: DEFAULT_SEARCH_CONFIG.keywordGroups,
      excludedKeywordGroups: DEFAULT_SEARCH_CONFIG.excludedKeywordGroups,
      locationFilters: DEFAULT_SEARCH_CONFIG.locationFilters,
      minimumScore: DEFAULT_SEARCH_CONFIG.minimumScore,
      applyNowThreshold: DEFAULT_SEARCH_CONFIG.applyNowThreshold,
      includeStretchRoles: DEFAULT_SEARCH_CONFIG.includeStretchRoles,
      includeContractJobs: DEFAULT_SEARCH_CONFIG.includeContractJobs,
      includeGraduateRoles: DEFAULT_SEARCH_CONFIG.includeGraduateRoles,
      includeRemoteIreland: DEFAULT_SEARCH_CONFIG.includeRemoteIreland,
      includeSuspiciousMatches: DEFAULT_SEARCH_CONFIG.includeSuspiciousMatches,
      refreshFrequencyMinutes: DEFAULT_SEARCH_CONFIG.refreshFrequencyMinutes
    }
  });
}

async function seedKeywordGroups(prisma: Awaited<ReturnType<typeof loadRuntime>>['prisma']) {
  await prisma.keywordGroup.createMany({
    data: [
      {
        key: 'include-core-analytics',
        label: 'Core analytics role capture',
        groupType: 'include',
        keywords: SEARCH_KEYWORD_GROUPS,
        weight: 1.5,
        isActive: true
      },
      {
        key: 'exclude-hard-engineering',
        label: 'Exclude engineering-heavy jobs',
        groupType: 'exclude',
        keywords: ['data engineer', 'machine learning engineer', 'platform engineer', 'architect'],
        weight: 1,
        isActive: true
      }
    ]
  });
}

async function loadRuntime() {
  const [{ prisma }, { runScan }] = await Promise.all([import('@/src/lib/prisma'), import('@/src/services/scan-service')]);
  return { prisma, runScan };
}

async function main() {
  const { prisma, runScan } = await loadRuntime();
  try {
    await clearDatabase(prisma);
    await seedSources(prisma);
    await seedSearchConfig(prisma);
    await seedKeywordGroups(prisma);

    const scan = await runScan();
    console.log('Seed completed. Scan summary:', JSON.stringify(scan, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
