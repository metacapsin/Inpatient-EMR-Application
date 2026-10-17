import { config } from './config.js';
import { createApp } from './app.js';
import { pool } from './db/pool.js';

const app = createApp();
const server = app.listen(config.port, () => {
    console.log(`[server] EMR API listening on http://localhost:${config.port} (${config.env})`);
    pool
        .query('SELECT 1')
        .then(() => console.log('[server] PostgreSQL connection OK'))
        .catch((e) => console.error(`[server] PostgreSQL connection FAILED: ${e.message}\n         Start a database (npm run db:embedded) and run npm run db:setup.`));
});

const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
