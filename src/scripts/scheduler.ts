import cron from 'node-cron';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function startScheduler() {
  const { env } = await import('@/src/lib/env');
  const { logger } = await import('@/src/lib/logger');
  const { runScan } = await import('@/src/services/scan-service');

  async function runScheduledScan() {
    try {
      const result = await runScan();
      logger.info('scheduled scan completed', result);
    } catch (error) {
      logger.error('scheduled scan failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  logger.info('scheduler started', { cron: env.cronSchedule });

  cron.schedule(env.cronSchedule, () => {
    void runScheduledScan();
  });

  await runScheduledScan();
}

void startScheduler();
