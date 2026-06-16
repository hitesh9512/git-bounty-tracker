import { Queue } from 'bullmq';
import { config } from '../config';

import { URL } from 'url';

const redisUrl = new URL(config.REDIS_URL);

export const connectionOptions = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
};

export const scannerQueue = new Queue('scannerQueue', {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

/**
 * Add a job to scan a specific organization
 */
export async function addOrgScanJob(organizationId: string) {
  await scannerQueue.add(
    `scan_org_${organizationId}`,
    { organizationId },
    { jobId: `org_${organizationId}` } // Prevent duplicate active scans for the same org
  );
}

/**
 * Setup a repeatable job to trigger scans for all organizations periodically
 */
export async function setupRepeatableScan() {
  const repeatableJobs = await scannerQueue.getRepeatableJobs();
  
  // Remove existing repeatable jobs to avoid duplicates on restart
  for (const job of repeatableJobs) {
    if (job.name === 'trigger_all_scans') {
      await scannerQueue.removeRepeatableByKey(job.key);
    }
  }

  // Register repeatable job
  await scannerQueue.add(
    'trigger_all_scans',
    {},
    {
      repeat: {
        every: config.SCAN_INTERVAL_MS,
      },
    }
  );
  console.log(`Scheduled global scans to repeat every ${config.SCAN_INTERVAL_MS} ms`);
}
