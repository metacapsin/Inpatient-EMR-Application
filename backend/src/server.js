import { config } from './config.js';
import { createApp } from './app.js';
import { pool } from './db/pool.js';
import { boss, startQueue } from './db/queue.js';
import { registerRcopiaSyncWorker } from './jobs/rcopiaSync.js';
import { registerAdtNotificationWorker } from './jobs/adtNotification.js';
import { registerBedReservationExpiryWorker } from './jobs/bedReservationExpiry.js';

const app = createApp();
const server = app.listen(config.port, () => {
    console.log(`[server] EMR API listening on http://localhost:${config.port} (${config.env})`);
    pool
        .query('SELECT 1')
        .then(() => console.log('[server] PostgreSQL connection OK'))
        .catch((e) => console.error(`[server] PostgreSQL connection FAILED: ${e.message}\n         Start a database (npm run db:embedded) and run npm run db:setup.`));
});

startQueue()
    .then(async () => {
        await registerRcopiaSyncWorker();
        await registerAdtNotificationWorker();
        await registerBedReservationExpiryWorker();
        console.log('[server] job queue started (rcopia-patient-sync, adt-notification, bed-reservation-expiry)');
    })
    .catch((e) => console.error(`[server] job queue failed to start: ${e.message}`));

const shutdown = () => server.close(() => Promise.all([pool.end(), boss.stop()]).finally(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
