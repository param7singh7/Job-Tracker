import { prisma } from '@/src/lib/prisma';
import { DEFAULT_SEARCH_CONFIG } from '@/src/config/default-search-config';
import { logger } from '@/src/lib/logger';
import { getDemoSourceHealth } from '@/src/services/demo-fallback';

export async function getSourceHealth() {
  try {
    const sources = await prisma.source.findMany({
      where: {
        name: {
          in: DEFAULT_SEARCH_CONFIG.includedSources
        }
      },
      include: {
        scanResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            scanRun: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return sources.map((source) => {
      const latest = source.scanResults[0];

      return {
        source: source.name,
        health: source.health,
        enabled: source.enabled,
        mockMode: source.mockMode,
        lastSuccessfulScan: source.lastSuccessfulScan,
        lastScanAttemptAt: source.lastScanAttemptAt,
        lastError: source.lastError,
        latestResult: latest
          ? {
              status: latest.status,
              fetchedCount: latest.fetchedCount,
              parsedCount: latest.parsedCount,
              duplicateCount: latest.duplicateCount,
              errorCount: latest.errorCount,
              durationMs: latest.durationMs,
              scanRunId: latest.scanRunId,
              createdAt: latest.createdAt
            }
          : null
      };
    });
  } catch (error) {
    logger.warn('getSourceHealth fallback to demo data', {
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
    return getDemoSourceHealth();
  }
}
