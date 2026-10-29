import { boss, QUEUES } from '../db/queue.js';
import { pool } from '../db/pool.js';
import { sweepExpiredReservations } from '../lib/bedManagement.js';

/**
 * Timed bed holds auto-expire: every minute, any `active` bed_reservations row past its expires_at
 * becomes `expired` and the bed goes back to 'available' (or 'dirty' if a clean is still open).
 * The ADT/reservation routes also sweep lazily, so a missed tick never blocks a placement.
 */
export async function registerBedReservationExpiryWorker() {
    await boss.work(QUEUES.BED_RESERVATION_EXPIRY, async () => {
        const n = await sweepExpiredReservations(pool);
        if (n) console.log(`[bed-reservation-expiry] released ${n} expired hold(s)`);
    });
    // pg-boss keys schedules by queue name, so re-registering on every boot is idempotent.
    await boss.schedule(QUEUES.BED_RESERVATION_EXPIRY, '* * * * *');
}
