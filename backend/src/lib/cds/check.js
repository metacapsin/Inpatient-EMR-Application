// @ts-check
import { cdsAlertSchema } from './schemas.js';
import { effectiveSeverity, sortAlertsBySeverity } from './policy.js';

/** @typedef {import('./schemas.js').CdsAlert} CdsAlert */
/** @typedef {import('./schemas.js').CdsCandidate} CdsCandidate */

/**
 * @param {any} db pool / client / sql `q` function
 * @param {string} text
 * @param {unknown=} [params]
 */
async function runQuery(db, text, params) {
    if (typeof db === 'function') return db(text, params);
    return db.query(text, params);
}

/**
 * @param {any} db
 * @param {{ tenantId: string, patientId: string, candidates: Array<{ rxnormCode?: string | null, name: string }> }} input
 * @returns {Promise<CdsAlert[]>}
 */
export async function checkInteractions(db, input) {
    const { tenantId, patientId, candidates } = input;
    /** @type {CdsAlert[]} */
    const alerts = [];

    const meds = (
        await runQuery(
            db,
            `SELECT id, name, rxnorm_code FROM medications
             WHERE tenant_id = $1 AND patient_id = $2 AND is_active = true
               AND COALESCE(rxnorm_code, '') <> ''`,
            [tenantId, patientId],
        )
    ).rows;

    const allergies = (
        await runQuery(
            db,
            `SELECT id, allergen, rxnorm_code, allergy_class FROM patient_allergies
             WHERE tenant_id = $1 AND patient_id = $2
               AND COALESCE(clinical_status, CASE WHEN is_active THEN 'active' ELSE 'inactive' END) = 'active'`,
            [tenantId, patientId],
        )
    ).rows;

    const rules = (await runQuery(db, `SELECT * FROM drug_interaction_rules`)).rows;
    const overrides = (
        await runQuery(db, `SELECT rule_id, severity FROM cds_severity_overrides WHERE tenant_id = $1`, [tenantId])
    ).rows;
    /** @type {Map<string, string>} */
    const overrideByRule = new Map(overrides.map((/** @type {any} */ o) => [o.rule_id, o.severity]));

    for (const cand of candidates) {
        const code = cand.rxnormCode?.trim() || null;
        if (!code) {
            alerts.push(
                cdsAlertSchema.parse({
                    ruleId: null,
                    ruleType: null,
                    severity: 'minor',
                    message: `Unmatched drug "${cand.name}" — interaction check not possible. Select a coded drug from search when available.`,
                    candidateName: cand.name,
                    source: 'advisory',
                }),
            );
            continue;
        }

        for (const rule of rules) {
            const ov = overrideByRule.get(rule.id);
            const sev = effectiveSeverity(rule.severity, ov);
            if (!sev) continue;

            if (rule.rule_type === 'drug_drug') {
                const a = rule.rxnorm_code_a;
                const b = rule.rxnorm_code_b;
                // Candidate vs active meds (both directions)
                for (const med of meds) {
                    const mCode = med.rxnorm_code;
                    if (!((code === a && mCode === b) || (code === b && mCode === a))) continue;
                    alerts.push(
                        cdsAlertSchema.parse({
                            ruleId: rule.id,
                            ruleType: 'drug_drug',
                            severity: sev,
                            message: rule.description,
                            rxnormCodeA: a,
                            rxnormCodeB: b,
                            candidateName: cand.name,
                            matchedName: med.name,
                            source: rule.source,
                        }),
                    );
                }
                // Candidate vs other candidates in the same batch (e.g. multi-line Rx)
                for (const other of candidates) {
                    if (other === cand) continue;
                    const oCode = other.rxnormCode?.trim();
                    if (!oCode) continue;
                    if (!((code === a && oCode === b) || (code === b && oCode === a))) continue;
                    // Deduplicate by sorting pair key later via message+codes
                    alerts.push(
                        cdsAlertSchema.parse({
                            ruleId: rule.id,
                            ruleType: 'drug_drug',
                            severity: sev,
                            message: rule.description,
                            rxnormCodeA: a,
                            rxnormCodeB: b,
                            candidateName: cand.name,
                            matchedName: other.name,
                            source: rule.source,
                        }),
                    );
                }
            } else if (rule.rule_type === 'drug_allergy_class') {
                if (code !== rule.rxnorm_code_a) continue;
                for (const all of allergies) {
                    if (!all.allergy_class || all.allergy_class !== rule.allergy_class) continue;
                    alerts.push(
                        cdsAlertSchema.parse({
                            ruleId: rule.id,
                            ruleType: 'drug_allergy_class',
                            severity: sev,
                            message: rule.description,
                            rxnormCodeA: rule.rxnorm_code_a,
                            allergyClass: rule.allergy_class,
                            candidateName: cand.name,
                            matchedName: all.allergen,
                            source: rule.source,
                        }),
                    );
                }
            }
        }
    }

    // Deduplicate identical rule+candidate+matched triples
    const seen = new Set();
    /** @type {CdsAlert[]} */
    const unique = [];
    for (const a of alerts) {
        const key = `${a.ruleId ?? 'uncoded'}|${a.candidateName ?? ''}|${a.matchedName ?? ''}|${a.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(a);
    }

    return sortAlertsBySeverity(unique);
}

/**
 * Persist alert audit rows.
 * @param {any} db
 * @param {{
 *   tenantId: string,
 *   patientId: string,
 *   contextType: 'cpoe_order' | 'prescription_sign' | 'med_rec',
 *   contextId: string | null,
 *   alerts: CdsAlert[],
 *   outcome: 'blocked' | 'overridden' | 'advisory',
 *   userId?: string | null,
 *   overrideReason?: string | null,
 * }} opts
 */
export async function recordCdsAlerts(db, opts) {
    for (const a of opts.alerts) {
        await runQuery(
            db,
            `INSERT INTO cds_alerts
               (tenant_id, patient_id, context_type, context_id, rule_id, severity, message, outcome, overridden_by, override_reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
                opts.tenantId,
                opts.patientId,
                opts.contextType,
                opts.contextId,
                a.ruleId,
                a.severity,
                a.message,
                opts.outcome,
                opts.outcome === 'overridden' ? opts.userId ?? null : null,
                opts.outcome === 'overridden' ? opts.overrideReason ?? null : null,
            ],
        );
    }
}
