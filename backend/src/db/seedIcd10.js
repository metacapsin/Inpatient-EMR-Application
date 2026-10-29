/**
 * Import official ICD-10-CM order file into icd10_codes.
 *
 * Source (FY2026 example):
 *   https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2026/icd10cm-Code%20Descriptions-2026.zip
 * Extract `icd10cm-order-2026.txt` (CMS/NCHS fixed-width order file).
 *
 * Usage:
 *   ICD10_ORDER_FILE=path/to/icd10cm-order-2026.txt npm run db:seed:icd10
 *   ICD10_EFFECTIVE_YEAR=2026 npm run db:seed:icd10   # year written on each row
 *
 * If ICD10_ORDER_FILE is unset, looks under backend/data/icd10/ for icd10cm-order-*.txt
 * and optionally downloads the FY2026 zip when ICD10_AUTO_DOWNLOAD=1.
 *
 * Completeness: fails if imported row count is below ICD10_MIN_ROWS (default 70000)
 * unless ICD10_ALLOW_PARTIAL=1 is set (explicit partial catalog — never silent).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import { pool } from './pool.js';
import { parseOrderLine } from './icd10OrderFile.js';

export { formatIcd10Code, parseOrderLine } from './icd10OrderFile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data/icd10');
const DEFAULT_YEAR = Number(process.env.ICD10_EFFECTIVE_YEAR || 2026);
const MIN_ROWS = Number(process.env.ICD10_MIN_ROWS || 70_000);
const ALLOW_PARTIAL = process.env.ICD10_ALLOW_PARTIAL === '1';
const AUTO_DOWNLOAD = process.env.ICD10_AUTO_DOWNLOAD === '1';
const FY2026_ZIP_URL =
    'https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2026/icd10cm-Code%20Descriptions-2026.zip';

function resolveOrderFile() {
    if (process.env.ICD10_ORDER_FILE) {
        const p = path.resolve(process.env.ICD10_ORDER_FILE);
        if (!fs.existsSync(p)) {
            throw new Error(`ICD10_ORDER_FILE not found: ${p}`);
        }
        return p;
    }
    if (!fs.existsSync(DATA_DIR)) return null;
    const matches = fs
        .readdirSync(DATA_DIR)
        .filter((f) => /^icd10cm-order-\d{4}\.txt$/i.test(f))
        .sort()
        .reverse();
    if (matches.length) return path.join(DATA_DIR, matches[0]);
    return null;
}

async function downloadFy2026() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const zipPath = path.join(DATA_DIR, 'icd10cm-Code-Descriptions-2026.zip');
    console.log(`[seed:icd10] downloading ${FY2026_ZIP_URL}`);
    const res = await fetch(FY2026_ZIP_URL);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    await pipeline(res.body, createWriteStream(zipPath));
    // Prefer PowerShell Expand-Archive on Windows; fall back to noting manual unzip.
    const { execFileSync } = await import('node:child_process');
    try {
        execFileSync(
            'powershell.exe',
            ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${DATA_DIR.replace(/'/g, "''")}' -Force`],
            { stdio: 'inherit' },
        );
    } catch {
        throw new Error(
            `Downloaded zip to ${zipPath} but could not unzip automatically. Unzip manually into ${DATA_DIR} and re-run.`,
        );
    }
}

async function* readRecords(filePath) {
    const rl = readline.createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
        const rec = parseOrderLine(line);
        if (rec) yield rec;
    }
}

export async function seedIcd10({ effectiveYear = DEFAULT_YEAR, filePath } = {}) {
    let orderFile = filePath || resolveOrderFile();
    if (!orderFile && AUTO_DOWNLOAD) {
        await downloadFy2026();
        orderFile = resolveOrderFile();
    }
    if (!orderFile) {
        throw new Error(
            [
                'No ICD-10-CM order file found.',
                `Place icd10cm-order-YYYY.txt under ${DATA_DIR}, or set ICD10_ORDER_FILE=...`,
                `Download: ${FY2026_ZIP_URL}`,
                'Or re-run with ICD10_AUTO_DOWNLOAD=1 to fetch FY2026 automatically.',
            ].join('\n'),
        );
    }

    console.log(`[seed:icd10] reading ${orderFile} (effective_year=${effectiveYear})`);

    let inserted = 0;
    let updated = 0;
    let rejected = 0;
    let total = 0;
    const batch = [];
    const BATCH_SIZE = 500;

    const flush = async (client) => {
        if (!batch.length) return;
        const values = [];
        const params = [];
        let i = 1;
        for (const r of batch) {
            values.push(`($${i++},$${i++},$${i++},$${i++})`);
            params.push(r.code, r.description, r.billable, effectiveYear);
        }
        const sql = `
            INSERT INTO icd10_codes (code, description, billable, effective_year)
            VALUES ${values.join(',')}
            ON CONFLICT (code) DO UPDATE SET
                description = EXCLUDED.description,
                billable = EXCLUDED.billable,
                effective_year = EXCLUDED.effective_year
            RETURNING (xmax = 0) AS was_insert`;
        const result = await client.query(sql, params);
        for (const row of result.rows) {
            if (row.was_insert) inserted += 1;
            else updated += 1;
        }
        batch.length = 0;
    };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for await (const rec of readRecords(orderFile)) {
            total += 1;
            if (!rec.code || !rec.description) {
                rejected += 1;
                continue;
            }
            batch.push(rec);
            if (batch.length >= BATCH_SIZE) await flush(client);
        }
        await flush(client);

        if (total < MIN_ROWS && !ALLOW_PARTIAL) {
            await client.query('ROLLBACK');
            throw new Error(
                `Incomplete ICD-10 import: parsed ${total} rows but expected at least ${MIN_ROWS}. ` +
                    `Set ICD10_ALLOW_PARTIAL=1 to load a known-partial catalog explicitly.`,
            );
        }

        await client.query('COMMIT');
    } catch (e) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }
        throw e;
    } finally {
        client.release();
    }

    const count = (await pool.query('SELECT COUNT(*)::int AS n FROM icd10_codes')).rows[0].n;
    const summary = { file: orderFile, effectiveYear, parsed: total, inserted, updated, rejected, tableCount: count, partial: total < MIN_ROWS };
    console.log('[seed:icd10] done', summary);
    if (summary.partial) {
        console.warn('[seed:icd10] WARNING: catalog is below the full-set threshold — treat as partial.');
    }
    return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    seedIcd10()
        .then(() => pool.end())
        .catch((e) => {
            console.error('[seed:icd10] failed:', e.message);
            process.exit(1);
        });
}
