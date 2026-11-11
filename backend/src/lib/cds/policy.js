// @ts-check
import { CDS_SEVERITIES } from './schemas.js';

/** @typedef {import('./schemas.js').CdsAlert} CdsAlert */

const RANK = Object.fromEntries(CDS_SEVERITIES.map((s, i) => [s, i]));

/**
 * Effective severity after applying a tenant override. `suppressed` means drop the alert.
 * @param {string} ruleSeverity
 * @param {string | null | undefined} overrideSeverity
 * @returns {string | null} null when suppressed
 */
export function effectiveSeverity(ruleSeverity, overrideSeverity) {
    if (overrideSeverity === 'suppressed') return null;
    if (overrideSeverity && (/** @type {readonly string[]} */ (CDS_SEVERITIES)).includes(overrideSeverity)) {
        return overrideSeverity;
    }
    return ruleSeverity;
}

/**
 * True when any alert requires an override reason before proceeding (ONC (a)(4) hard stop).
 * @param {CdsAlert[]} alerts
 * @returns {boolean}
 */
export function requiresOverride(alerts) {
    return alerts.some((a) => a.severity === 'major' || a.severity === 'contraindicated');
}

/**
 * Sort alerts by severity descending (contraindicated first).
 * @param {CdsAlert[]} alerts
 * @returns {CdsAlert[]}
 */
export function sortAlertsBySeverity(alerts) {
    return [...alerts].sort((a, b) => (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0));
}

/**
 * @param {never} x
 * @returns {never}
 */
export function assertNever(x) {
    throw new Error(`Unexpected value: ${String(x)}`);
}
