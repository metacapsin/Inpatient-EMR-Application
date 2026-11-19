// SAF-25: resolves free-text lab test names against the stable-id catalog (lab_test_catalog) at
// order-creation time. A test not in the catalog keeps its caller-supplied code/specimen (or none) —
// this only fills gaps, it never overrides an explicit value, and a catalog miss is not an error.

/**
 * @param {{query: (sql: string, params: unknown[]) => Promise<{rows: any[]}>}} db
 * @param {Array<{name: string, code?: string|null, specimen?: string|null}>} tests
 * @returns {Promise<Array<{name: string, code?: string|null, specimen?: string|null}>>}
 */
export async function resolveLabTestCodes(db, tests) {
    const names = [...new Set(tests.map((t) => String(t.name ?? '').trim().toLowerCase()).filter(Boolean))];
    if (!names.length) return tests;
    const r = await db.query('SELECT code, name, default_specimen FROM lab_test_catalog WHERE lower(name) = ANY($1::text[])', [names]);
    const byName = new Map(r.rows.map((row) => [row.name.toLowerCase(), row]));
    return tests.map((t) => {
        const match = byName.get(String(t.name ?? '').trim().toLowerCase());
        if (!match) return t;
        return { ...t, code: t.code ?? match.code, specimen: t.specimen ?? match.default_specimen ?? null };
    });
}
