// @ts-check
import { Router } from 'express';
import { z } from 'zod';
import { q } from '../lib/sql.js';
import { ApiError, h, ok, parse, created } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { checkInteractions, recordCdsAlerts } from '../lib/cds/check.js';
import { requiresOverride, effectiveSeverity } from '../lib/cds/policy.js';
import {
    cdsAlertSchema,
    cdsCheckBodySchema,
    cdsOverrideSchema,
    cdsOverrideSeveritySchema,
} from '../lib/cds/schemas.js';
import { onBeforeSign } from '../lib/erx.js';

export const cdsRouter = Router();

/**
 * @param {Record<string, any>} r
 */
function alertLedgerOut(r) {
    return {
        id: r.id,
        patientId: r.patient_id,
        contextType: r.context_type,
        contextId: r.context_id,
        ruleId: r.rule_id,
        severity: r.severity,
        message: r.message,
        outcome: r.outcome,
        overriddenBy: r.overridden_by,
        overrideReason: r.override_reason,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    };
}

cdsRouter.post(
    '/api/cds/check',
    requireRole('physician', 'nurse', 'pharmacist', 'admin'),
    h(async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
        const b = parse(cdsCheckBodySchema, req.body);
        const patient = await q('SELECT id FROM patients WHERE id = $1 AND tenant_id = $2', [
            b.patientId,
            req.user?.tenantId,
        ]);
        if (!patient.rowCount) throw new ApiError(404, 'Patient not found');
        const alerts = await checkInteractions(q, {
            tenantId: /** @type {string} */ (req.user?.tenantId),
            patientId: b.patientId,
            candidates: b.candidates,
        });
        ok(res, z.array(cdsAlertSchema).parse(alerts));
    }),
);

cdsRouter.get(
    '/api/cds/alerts',
    requireRole('physician', 'pharmacist', 'admin'),
    h(async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
        const qIn = parse(
            z.object({
                patientId: z.string().min(1).optional(),
                contextId: z.string().min(1).optional(),
            }),
            req.query,
        );
        /** @type {unknown[]} */
        const params = [req.user?.tenantId];
        let sql = `SELECT * FROM cds_alerts WHERE tenant_id = $1`;
        if (qIn.patientId) {
            params.push(qIn.patientId);
            sql += ` AND patient_id = $${params.length}`;
        }
        if (qIn.contextId) {
            params.push(qIn.contextId);
            sql += ` AND context_id = $${params.length}`;
        }
        sql += ` ORDER BY created_at DESC LIMIT 200`;
        const r = await q(sql, params);
        ok(res, r.rows.map(alertLedgerOut));
    }),
);

cdsRouter.get(
    '/api/cds/rules',
    requireRole('physician', 'pharmacist', 'admin', 'nurse'),
    h(async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
        const rules = await q(`SELECT * FROM drug_interaction_rules ORDER BY severity DESC, description`);
        const overrides = await q(`SELECT rule_id, severity, set_by, set_at FROM cds_severity_overrides WHERE tenant_id = $1`, [
            req.user?.tenantId,
        ]);
        /** @type {Map<string, Record<string, any>>} */
        const ovMap = new Map(overrides.rows.map((o) => [String(o.rule_id), o]));
        ok(
            res,
            rules.rows.map((r) => {
                const ov = ovMap.get(String(r.id));
                const effective = effectiveSeverity(String(r.severity), ov?.severity);
                return {
                    id: r.id,
                    ruleType: r.rule_type,
                    rxnormCodeA: r.rxnorm_code_a,
                    rxnormCodeB: r.rxnorm_code_b,
                    allergyClass: r.allergy_class,
                    defaultSeverity: r.severity,
                    effectiveSeverity: effective === null ? 'suppressed' : effective,
                    description: r.description,
                    source: r.source,
                    overrideSeverity: ov?.severity ?? null,
                    overrideSetBy: ov?.set_by ?? null,
                    overrideSetAt: ov?.set_at instanceof Date ? ov.set_at.toISOString() : ov?.set_at ?? null,
                };
            }),
        );
    }),
);

cdsRouter.put(
    '/api/cds/severity-overrides/:ruleId',
    requireRole('admin'),
    h(async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
        const { ruleId } = parse(z.object({ ruleId: z.string().min(1) }), req.params);
        const { severity } = parse(z.object({ severity: cdsOverrideSeveritySchema }), req.body);
        const rule = await q(`SELECT id FROM drug_interaction_rules WHERE id = $1`, [ruleId]);
        if (!rule.rowCount) throw new ApiError(404, 'Rule not found');
        const r = await q(
            `INSERT INTO cds_severity_overrides (tenant_id, rule_id, severity, set_by, set_at)
             VALUES ($1,$2,$3,$4,now())
             ON CONFLICT (tenant_id, rule_id) DO UPDATE SET severity = EXCLUDED.severity, set_by = EXCLUDED.set_by, set_at = now()
             RETURNING *`,
            [req.user?.tenantId, ruleId, severity, req.user?.id],
        );
        const row = r.rows[0];
        if (!row) throw new ApiError(500, 'Override not saved');
        created(res, {
            ruleId: row.rule_id,
            severity: row.severity,
            setBy: row.set_by,
            setAt: row.set_at instanceof Date ? row.set_at.toISOString() : row.set_at,
        });
    }),
);

cdsRouter.delete(
    '/api/cds/severity-overrides/:ruleId',
    requireRole('admin'),
    h(async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
        const { ruleId } = parse(z.object({ ruleId: z.string().min(1) }), req.params);
        await q(`DELETE FROM cds_severity_overrides WHERE tenant_id = $1 AND rule_id = $2`, [
            req.user?.tenantId,
            ruleId,
        ]);
        ok(res, { deleted: true });
    }),
);

// e-Rx CDS interception — registered at import time.
onBeforeSign(async (/** @type {any} */ ctx) => {
    const { prescription, user, db } = ctx;
    const body = ctx.body ?? {};
    const medicines = Array.isArray(prescription.medicines) ? prescription.medicines : [];
    const candidates = medicines.map((/** @type {any} */ m) => ({
        name: m.name || m.drugName || 'medication',
        rxnormCode: m.rxnormCode ?? m.rxnorm_code ?? null,
    }));
    if (!candidates.length) return;

    const alerts = await checkInteractions(db, {
        tenantId: user.tenantId,
        patientId: prescription.patient_id,
        candidates,
    });
    if (!alerts.length) return;

    const overrideParse = cdsOverrideSchema.safeParse(body.cdsOverride);
    if (requiresOverride(alerts) && !overrideParse.success) {
        throw new ApiError(409, 'Clinical decision support override required', { alerts }, 'CDS_OVERRIDE_REQUIRED');
    }

    await recordCdsAlerts(db, {
        tenantId: user.tenantId,
        patientId: prescription.patient_id,
        contextType: 'prescription_sign',
        contextId: prescription.id,
        alerts,
        outcome: overrideParse.success ? 'overridden' : 'advisory',
        userId: user.id,
        overrideReason: overrideParse.success ? overrideParse.data.reason : null,
    });
});
