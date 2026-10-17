import pg from 'pg';
import { config } from '../config.js';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates (avoids timezone shifts).
pg.types.setTypeParser(1082, (v) => v);
// NUMERIC -> number (volumes/costs are small, precision loss is not a concern here).
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export const query = (text, params) => pool.query(text, params);

/** Run `fn(client)` in a transaction. */
export async function withTx(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
