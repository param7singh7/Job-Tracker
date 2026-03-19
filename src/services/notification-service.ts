import { logger } from '@/src/lib/logger';
import { env } from '@/src/lib/env';
import { getDashboardStats } from '@/src/services/stats-service';

export interface NotificationResult {
  sent: boolean;
  channels: string[];
  reason?: string;
}

async function sendWebhookDigest(payload: Record<string, unknown>): Promise<void> {
  for (const hook of env.webhooks) {
    try {
      await fetch(hook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      logger.warn('webhook notification failed', {
        hook,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export async function sendDailyDigestNotification(): Promise<NotificationResult> {
  const stats = await getDashboardStats();
  const channels: string[] = [];

  if (env.webhooks.length) {
    await sendWebhookDigest({
      type: 'daily-digest',
      generatedAt: new Date().toISOString(),
      stats
    });
    channels.push('webhook');
  }

  if (!channels.length) {
    return {
      sent: false,
      channels,
      reason: 'No notification channels configured (webhooks/email)'
    };
  }

  return {
    sent: true,
    channels
  };
}
