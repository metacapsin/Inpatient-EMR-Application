// @ts-check
/** Typed SQL helpers for checkJs-scoped modules (Patient Access / FHIR). */
import { query as rawQuery, withTx as rawWithTx } from '../db/pool.js';

/**
 * @typedef {Record<string, any>} DbRow
 * @typedef {{ rows: DbRow[], rowCount: number }} DbResult
 * @typedef {{ query: (text: string, params?: unknown) => Promise<DbResult> }} DbClient
 */

/**
 * @param {string} text
 * @param {unknown=} [params]
 * @returns {Promise<DbResult>}
 */
export async function q(text, params) {
    const r = await rawQuery(text, params);
    return {
        rows: /** @type {DbRow[]} */ (r.rows),
        rowCount: Number(r.rowCount ?? 0),
    };
}

/**
 * @template T
 * @param {(db: DbClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function tx(fn) {
    return rawWithTx(async (/** @type {import('pg').PoolClient} */ client) => {
        /** @type {DbClient} */
        const db = {
            async query(text, params) {
                const r = await client.query(text, /** @type {any} */ (params));
                return {
                    rows: /** @type {DbRow[]} */ (r.rows),
                    rowCount: Number(r.rowCount ?? 0),
                };
            },
        };
        return fn(db);
    });
}
