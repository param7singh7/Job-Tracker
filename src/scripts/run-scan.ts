import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main() {
  const { runScan } = await import('@/src/services/scan-service');
  const { sendDailyDigestNotification } = await import('@/src/services/notification-service');

  const scan = await runScan();
  console.log('scan-result', JSON.stringify(scan, null, 2));

  const notification = await sendDailyDigestNotification();
  console.log('notification-result', JSON.stringify(notification, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
