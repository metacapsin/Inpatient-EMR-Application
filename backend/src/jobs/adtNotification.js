import { boss, QUEUES } from '../db/queue.js';
import { processAdtNotificationJob } from '../lib/adtNotify.js';

/**
 * Delivers queued CMS CoP ADT notifications (see lib/adtNotify.js for the fan-out and lib/adtTransport.js
 * for the transports). pg-boss retries a failed job up to 5 times with backoff; only rows that are not yet
 * `sent` are re-attempted.
 */
export function registerAdtNotificationWorker() {
    return boss.work(QUEUES.ADT_NOTIFICATION, async ([job]) => {
        const r = await processAdtNotificationJob(job.data);
        console.log(`[adt-notification] ${job.data.eventType} encounter ${job.data.encounterId}: sent ${r.sent}`);
    });
}
