/** Pure helpers for CMS/NCHS ICD-10-CM order-file lines (no DB I/O). */

/** Format dotted ICD-10-CM display code from the 7-char order-file code (no decimal). */
export function formatIcd10Code(raw) {
    const c = String(raw || '').trim().toUpperCase();
    if (!c) return '';
    if (c.includes('.')) return c;
    if (c.length <= 3) return c;
    return `${c.slice(0, 3)}.${c.slice(3)}`;
}

/**
 * Parse one CMS/NCHS order-file line (fixed-width).
 * Cols 1-5 order#, 7-13 code, 15 billable flag (1=billable leaf, 0=header), 17-76 short, 77+ long.
 */
export function parseOrderLine(line) {
    if (!line || line.length < 15) return null;
    const rawCode = line.slice(6, 13).trim();
    if (!rawCode) return null;
    const flag = line.slice(14, 15);
    const shortDesc = line.length >= 76 ? line.slice(16, 76).trim() : line.slice(16).trim();
    const longDesc = line.length > 76 ? line.slice(76).trim() : '';
    const description = longDesc || shortDesc;
    if (!description) return null;
    return {
        code: formatIcd10Code(rawCode),
        description,
        billable: flag === '1',
    };
}
