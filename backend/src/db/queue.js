import PgBoss from 'pg-boss';
import { config } from '../config.js';

export const QUEUES = {
    RCOPIA_PATIENT_SYNC: 'rcopia-patient-sync',
    ADT_NOTIFICATION: 'adt-notification',
    BED_RESERVATION_EXPIRY: 'bed-reservation-expiry',
};

export const boss = new PgBoss(config.databaseUrl);
boss.on('error', (err) => console.error('[queue] error:', err.message));

let started = null;

/** Idempotent: starts pg-boss (creates its schema on first run) and the queues above, once per process. */
export async function startQueue() {
    if (!started) {
        started = boss.start().then(async () => {
            for (const queue of Object.values(QUEUES)) await boss.createQueue(queue);
            return boss;
        });
    }
    return started;
}
