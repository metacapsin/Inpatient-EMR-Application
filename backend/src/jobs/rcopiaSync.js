import { boss, QUEUES } from '../db/queue.js';

/**
 * Syncs a newly-created patient's demographics to Rcopia (DrFirst's e-prescribing platform).
 * Stubbed: no DrFirst partner API credentials yet. Logging here is the only thing that changes
 * once that integration exists — the job payload and enqueue call stay the same.
 */
async function sendToRcopia(payload) {
    console.log('[rcopia-sync:stub] would sync patient to Rcopia:', JSON.stringify(payload));
}

export function registerRcopiaSyncWorker() {
    return boss.work(QUEUES.RCOPIA_PATIENT_SYNC, async ([job]) => {
        await sendToRcopia(job.data);
    });
}
