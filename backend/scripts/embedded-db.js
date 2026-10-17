// Dev-only: runs a real PostgreSQL server (no install / admin rights needed) using the
// `embedded-postgres` package. Credentials and port come from DATABASE_URL in backend/.env.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = new URL(process.env.DATABASE_URL);
const dataDir = path.resolve(root, process.env.PGDATA_DIR || './.pgdata');
const dbName = url.pathname.slice(1);

const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: Number(url.port || 5432),
    persistent: true,
});

const fresh = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase(dbName);
console.log(`[embedded-pg] ready on port ${url.port || 5432}, database "${dbName}" (data: ${dataDir})`);

const stop = async () => {
    await pg.stop();
    process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
