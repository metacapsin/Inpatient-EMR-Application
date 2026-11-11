// @ts-check
import { Router } from 'express';
import { q } from '../lib/sql.js';
import { ApiError, h } from '../lib/http.js';
import { requireSmartAuth, smartScopeAllows } from '../middleware/smartAuth.js';
import { searchsetBundle } from '../lib/fhir/bundle.js';
import { operationOutcome } from '../lib/fhir/outcome.js';
import { toFhirPatient } from '../lib/fhir/patient.js';
import { toFhirEncounter } from '../lib/fhir/encounter.js';
import { toFhirCondition } from '../lib/fhir/condition.js';
import { toFhirAllergyIntolerance } from '../lib/fhir/allergyIntolerance.js';
import {
    toFhirMedicationRequestFromMedication,
    toFhirMedicationRequestFromPrescriptionLine,
} from '../lib/fhir/medicationRequest.js';
import { toFhirVitalObservation, toFhirLabObservation } from '../lib/fhir/observation.js';
import { toFhirImmunization } from '../lib/fhir/immunization.js';
import { toFhirDocumentReference } from '../lib/fhir/documentReference.js';

export const fhirRouter = Router();

const FHIR_JSON = 'application/fhir+json';

/** @typedef {'Patient'|'Encounter'|'Condition'|'AllergyIntolerance'|'MedicationRequest'|'Observation'|'Immunization'|'DocumentReference'} FhirType */

/** @type {FhirType[]} */
const SEARCHABLE = [
    'Patient',
    'Encounter',
    'Condition',
    'AllergyIntolerance',
    'MedicationRequest',
    'Observation',
    'Immunization',
    'DocumentReference',
];

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {unknown} body
 */
function sendFhir(res, status, body) {
    res.status(status).type(FHIR_JSON).json(body);
}

/**
 * @param {import('express').Request} req
 * @returns {NonNullable<import('express').Request['smart']>}
 */
function smartCtx(req) {
    if (!req.smart) throw new ApiError(401, 'Authentication required');
    return req.smart;
}

/**
 * @param {import('express').Request} req
 * @param {number} status
 * @param {string | null} resourceType
 * @param {string | null} resourceId
 */
async function logAccess(req, status, resourceType, resourceId) {
    try {
        const smart = req.smart;
        await q(
            `INSERT INTO fhir_access_log (tenant_id, patient_id, client_id, resource_type, resource_id, query, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
                smart?.tenantId ?? null,
                smart?.patientId ?? null,
                smart?.clientId ?? null,
                resourceType,
                resourceId,
                (req.originalUrl || req.url || '').slice(0, 2000),
                status,
            ],
        );
    } catch (e) {
        console.error('[fhir_access_log]', /** @type {Error} */ (e).message);
    }
}

/**
 * @param {string | null} resourceType
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<{ status: number, body: unknown, resourceId?: string | null }>} fn
 */
function fhirH(resourceType, fn) {
    return h(async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
        try {
            const result = await fn(req, res);
            await logAccess(req, result.status, resourceType, result.resourceId ?? null);
            sendFhir(res, result.status, result.body);
        } catch (err) {
            const status = err instanceof ApiError ? err.status : 500;
            const message = err instanceof ApiError ? err.message : 'Internal server error';
            if (!(err instanceof ApiError)) console.error('[fhir]', err);
            await logAccess(req, status, resourceType, null);
            sendFhir(res, status, operationOutcome(status, message));
        }
    });
}

/**
 * @param {import('express').Request} req
 * @param {string} type
 */
function assertTypeScope(req, type) {
    const scope = `patient/${type}.read`;
    if (!smartScopeAllows(smartCtx(req).scopes || [], scope)) {
        throw new ApiError(403, `Missing required scope: ${scope}`);
    }
}

/**
 * @param {import('express').Request} req
 */
function parseSearchPaging(req) {
    const countRaw = Number(req.query._count ?? 50);
    const count = Number.isFinite(countRaw) ? Math.min(Math.max(1, Math.floor(countRaw)), 200) : 50;
    const lastUpdated = req.query._lastUpdated ? String(req.query._lastUpdated) : null;
    return { count, lastUpdated };
}

/**
 * @param {string | null} lastUpdated
 * @param {string} column
 * @param {unknown[]} params
 * @param {number} startIdx
 */
function lastUpdatedClause(lastUpdated, column, params, startIdx) {
    if (!lastUpdated) return { sql: '', nextIdx: startIdx };
    params.push(lastUpdated);
    return { sql: ` AND ${column} >= $${startIdx}::timestamptz`, nextIdx: startIdx + 1 };
}

fhirRouter.get(
    '/fhir/metadata',
    fhirH(null, async () => {
        /** @type {fhir4.CapabilityStatement} */
        const cs = {
            resourceType: 'CapabilityStatement',
            status: 'active',
            date: new Date().toISOString(),
            kind: 'instance',
            fhirVersion: '4.0.1',
            format: ['application/fhir+json'],
            rest: [
                {
                    mode: 'server',
                    security: {
                        service: [
                            {
                                coding: [
                                    {
                                        system: 'http://hl7.org/fhir/restful-security-service',
                                        code: 'SMART-on-FHIR',
                                    },
                                ],
                            },
                        ],
                        description: 'OAuth2 via SMART App Launch 2.0 (PKCE S256)',
                    },
                    resource: SEARCHABLE.map((type) => ({
                        type,
                        interaction: [{ code: 'read' }, { code: 'search-type' }],
                        searchParam: [
                            { name: 'patient', type: 'reference' },
                            { name: '_count', type: 'number' },
                            { name: '_lastUpdated', type: 'date' },
                        ],
                    })),
                },
            ],
        };
        return { status: 200, body: cs };
    }),
);

fhirRouter.get(
    '/fhir/Patient/:id',
    requireSmartAuth('patient/Patient.read'),
    fhirH('Patient', async (req) => {
        assertTypeScope(req, 'Patient');
        const id = String(req.params.id);
        const ctx = smartCtx(req);
        if (id !== ctx.patientId) {
            return { status: 404, body: operationOutcome(404, 'Patient not found'), resourceId: id };
        }
        const r = await q(`SELECT * FROM patients WHERE id = $1 AND tenant_id = $2`, [id, ctx.tenantId]);
        if (!r.rowCount || !r.rows[0]) {
            return { status: 404, body: operationOutcome(404, 'Patient not found'), resourceId: id };
        }
        return { status: 200, body: toFhirPatient(r.rows[0]), resourceId: id };
    }),
);

/**
 * @param {string} tenantId
 * @param {string} patientId
 * @param {string | null} lastUpdated
 * @param {number} count
 * @param {string} [id]
 * @returns {Promise<fhir4.MedicationRequest[]>}
 */
async function loadMedicationRequests(tenantId, patientId, lastUpdated, count, id) {
    /** @type {fhir4.MedicationRequest[]} */
    const out = [];

    if (id && id.includes(':')) {
        const [rxId, idxStr] = id.split(':');
        const idx = Number(idxStr);
        const rx = (
            await q(
                `SELECT * FROM prescriptions WHERE id = $1 AND tenant_id = $2 AND patient_id = $3
                 AND status NOT IN ('draft','cancelled')`,
                [rxId, tenantId, patientId],
            )
        ).rows[0];
        if (!rx) return [];
        const medicines = Array.isArray(rx.medicines) ? rx.medicines : [];
        const line = medicines[idx];
        if (!line) return [];
        return [toFhirMedicationRequestFromPrescriptionLine(rx, line, idx)];
    }

    if (id && !id.includes(':')) {
        const med = (
            await q(`SELECT * FROM medications WHERE id = $1 AND tenant_id = $2 AND patient_id = $3`, [
                id,
                tenantId,
                patientId,
            ])
        ).rows[0];
        return med ? [toFhirMedicationRequestFromMedication(med)] : [];
    }

    const medParams = /** @type {unknown[]} */ ([tenantId, patientId]);
    const medLu = lastUpdatedClause(lastUpdated, 'created_at', medParams, 3);
    const meds = await q(
        `SELECT * FROM medications WHERE tenant_id = $1 AND patient_id = $2${medLu.sql}
         ORDER BY created_at DESC LIMIT $${medLu.nextIdx}`,
        [...medParams, count],
    );
    for (const m of meds.rows) out.push(toFhirMedicationRequestFromMedication(m));

    const rxParams = /** @type {unknown[]} */ ([tenantId, patientId]);
    const rxLu = lastUpdatedClause(lastUpdated, 'COALESCE(signed_at, ordered_at)', rxParams, 3);
    const rxs = await q(
        `SELECT * FROM prescriptions
         WHERE tenant_id = $1 AND patient_id = $2 AND status NOT IN ('draft','cancelled')${rxLu.sql}
         ORDER BY COALESCE(signed_at, ordered_at) DESC LIMIT $${rxLu.nextIdx}`,
        [...rxParams, count],
    );
    for (const rx of rxs.rows) {
        const medicines = Array.isArray(rx.medicines) ? /** @type {Record<string, any>[]} */ (rx.medicines) : [];
        medicines.forEach((line, i) => {
            out.push(toFhirMedicationRequestFromPrescriptionLine(rx, line, i));
        });
    }
    return out.slice(0, count);
}

/**
 * @param {import('express').Request} req
 * @param {FhirType} type
 * @param {string} id
 */
async function readById(req, type, id) {
    assertTypeScope(req, type);
    const { tenantId, patientId } = smartCtx(req);

    if (type === 'Patient') {
        if (id !== patientId) return null;
        const r = await q(`SELECT * FROM patients WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
        return r.rows[0] ? toFhirPatient(r.rows[0]) : null;
    }
    if (type === 'Encounter') {
        const r = await q(`SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2 AND patient_id = $3`, [
            id,
            tenantId,
            patientId,
        ]);
        return r.rows[0] ? toFhirEncounter(r.rows[0]) : null;
    }
    if (type === 'Condition') {
        const r = await q(`SELECT * FROM problems WHERE id = $1 AND tenant_id = $2 AND patient_id = $3`, [
            id,
            tenantId,
            patientId,
        ]);
        return r.rows[0] ? toFhirCondition(r.rows[0]) : null;
    }
    if (type === 'AllergyIntolerance') {
        const r = await q(`SELECT * FROM patient_allergies WHERE id = $1 AND tenant_id = $2 AND patient_id = $3`, [
            id,
            tenantId,
            patientId,
        ]);
        return r.rows[0] ? toFhirAllergyIntolerance(r.rows[0]) : null;
    }
    if (type === 'MedicationRequest') {
        const list = await loadMedicationRequests(tenantId, patientId, null, 1, id);
        return list[0] ?? null;
    }
    if (type === 'Observation') {
        if (id.startsWith('vital-')) {
            const rawId = id.slice('vital-'.length);
            const r = await q(
                `SELECT * FROM health_metrics WHERE id = $1 AND tenant_id = $2 AND patient_id = $3`,
                [rawId, tenantId, patientId],
            );
            return r.rows[0] ? toFhirVitalObservation(r.rows[0]) : null;
        }
        if (id.startsWith('lab-')) {
            const rawId = id.slice('lab-'.length);
            const r = await q(`SELECT * FROM lab_results WHERE id = $1 AND tenant_id = $2 AND patient_id = $3`, [
                rawId,
                tenantId,
                patientId,
            ]);
            return r.rows[0] ? toFhirLabObservation(r.rows[0]) : null;
        }
        return null;
    }
    if (type === 'Immunization') {
        const r = await q(
            `SELECT * FROM patient_immunizations WHERE id = $1 AND tenant_id = $2 AND patient_id = $3`,
            [id, tenantId, patientId],
        );
        return r.rows[0] ? toFhirImmunization(r.rows[0]) : null;
    }
    if (type === 'DocumentReference') {
        const r = await q(
            `SELECT * FROM clinical_notes
             WHERE id = $1 AND tenant_id = $2 AND patient_id = $3 AND status = 'signed'`,
            [id, tenantId, patientId],
        );
        return r.rows[0] ? toFhirDocumentReference(r.rows[0]) : null;
    }
    return null;
}

/**
 * @param {import('express').Request} req
 * @param {FhirType} type
 */
async function searchType(req, type) {
    assertTypeScope(req, type);
    const { tenantId, patientId } = smartCtx(req);
    const { count, lastUpdated } = parseSearchPaging(req);
    const patient = String(req.query.patient || patientId);
    if (patient !== patientId) throw new ApiError(403, 'Patient parameter does not match authorized patient');

    /** @type {fhir4.FhirResource[]} */
    let resources = [];

    if (type === 'Patient') {
        const r = await q(`SELECT * FROM patients WHERE id = $1 AND tenant_id = $2`, [patientId, tenantId]);
        resources = r.rows.map((row) => toFhirPatient(row));
    } else if (type === 'Encounter') {
        const params = /** @type {unknown[]} */ ([tenantId, patientId]);
        const lu = lastUpdatedClause(lastUpdated, 'COALESCE(discharged_at, admitted_at, created_at)', params, 3);
        const r = await q(
            `SELECT * FROM encounters WHERE tenant_id = $1 AND patient_id = $2${lu.sql}
             ORDER BY admitted_at DESC LIMIT $${lu.nextIdx}`,
            [...params, count],
        );
        resources = r.rows.map((row) => toFhirEncounter(row));
    } else if (type === 'Condition') {
        const params = /** @type {unknown[]} */ ([tenantId, patientId]);
        const lu = lastUpdatedClause(lastUpdated, 'COALESCE(updated_at, created_at)', params, 3);
        const r = await q(
            `SELECT * FROM problems WHERE tenant_id = $1 AND patient_id = $2 AND status <> 'entered_in_error'${lu.sql}
             ORDER BY created_at DESC LIMIT $${lu.nextIdx}`,
            [...params, count],
        );
        resources = r.rows.map((row) => toFhirCondition(row));
    } else if (type === 'AllergyIntolerance') {
        const params = /** @type {unknown[]} */ ([tenantId, patientId]);
        const lu = lastUpdatedClause(lastUpdated, 'created_at', params, 3);
        const r = await q(
            `SELECT * FROM patient_allergies WHERE tenant_id = $1 AND patient_id = $2${lu.sql}
             ORDER BY created_at DESC LIMIT $${lu.nextIdx}`,
            [...params, count],
        );
        resources = r.rows.map((row) => toFhirAllergyIntolerance(row));
    } else if (type === 'MedicationRequest') {
        resources = await loadMedicationRequests(tenantId, patientId, lastUpdated, count);
    } else if (type === 'Observation') {
        const category = String(req.query.category || '');
        /** @type {fhir4.Observation[]} */
        const obs = [];
        if (!category || category.includes('vital')) {
            const params = /** @type {unknown[]} */ ([tenantId, patientId]);
            const lu = lastUpdatedClause(lastUpdated, 'recorded_at', params, 3);
            const r = await q(
                `SELECT * FROM health_metrics WHERE tenant_id = $1 AND patient_id = $2${lu.sql}
                 ORDER BY recorded_at DESC LIMIT $${lu.nextIdx}`,
                [...params, count],
            );
            obs.push(...r.rows.map((row) => toFhirVitalObservation(row)));
        }
        if (!category || category.includes('laboratory') || category.includes('lab')) {
            const params = /** @type {unknown[]} */ ([tenantId, patientId]);
            const lu = lastUpdatedClause(lastUpdated, 'resulted_at', params, 3);
            const r = await q(
                `SELECT * FROM lab_results WHERE tenant_id = $1 AND patient_id = $2${lu.sql}
                 ORDER BY resulted_at DESC LIMIT $${lu.nextIdx}`,
                [...params, count],
            );
            obs.push(...r.rows.map((row) => toFhirLabObservation(row)));
        }
        resources = obs.slice(0, count);
    } else if (type === 'Immunization') {
        const params = /** @type {unknown[]} */ ([tenantId, patientId]);
        const lu = lastUpdatedClause(lastUpdated, 'created_at', params, 3);
        const r = await q(
            `SELECT * FROM patient_immunizations WHERE tenant_id = $1 AND patient_id = $2${lu.sql}
             ORDER BY created_at DESC LIMIT $${lu.nextIdx}`,
            [...params, count],
        );
        resources = r.rows.map((row) => toFhirImmunization(row));
    } else if (type === 'DocumentReference') {
        const params = /** @type {unknown[]} */ ([tenantId, patientId]);
        const lu = lastUpdatedClause(lastUpdated, 'COALESCE(signed_at, updated_at)', params, 3);
        const r = await q(
            `SELECT * FROM clinical_notes
             WHERE tenant_id = $1 AND patient_id = $2 AND status = 'signed'${lu.sql}
             ORDER BY signed_at DESC NULLS LAST LIMIT $${lu.nextIdx}`,
            [...params, count],
        );
        resources = r.rows.map((row) => toFhirDocumentReference(row));
    }

    return searchsetBundle(resources, { total: resources.length });
}

for (const type of SEARCHABLE) {
    if (type === 'Patient') {
        fhirRouter.get(
            '/fhir/Patient',
            requireSmartAuth('patient/Patient.read'),
            fhirH('Patient', async (req) => {
                const bundle = await searchType(req, 'Patient');
                return { status: 200, body: bundle };
            }),
        );
        continue;
    }

    fhirRouter.get(
        `/fhir/${type}`,
        requireSmartAuth(`patient/${type}.read`),
        fhirH(type, async (req) => {
            const bundle = await searchType(req, type);
            return { status: 200, body: bundle };
        }),
    );

    fhirRouter.get(
        `/fhir/${type}/:id`,
        requireSmartAuth(`patient/${type}.read`),
        fhirH(type, async (req) => {
            const id = String(req.params.id);
            const resource = await readById(req, type, id);
            if (!resource) {
                return { status: 404, body: operationOutcome(404, `${type} not found`), resourceId: id };
            }
            return { status: 200, body: resource, resourceId: id };
        }),
    );
}
