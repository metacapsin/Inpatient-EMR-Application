/**
 * Eligibility runner (ported from EMR-Backend/api/services/eligibilityRunner.js).
 * Loads the practice (NPI + org name), resolves the insurance slots, calls Stedi per slot in
 * parallel, persists an eligibility_checks row whenever a saved patient is involved, and returns
 * compact per-slot summaries { primary?, secondary? }.
 */
import { query } from '../db/pool.js';
import * as stedi from './stedi.js';
import { buildEligibilityRequest, summarizeEligibilityResponse } from './eligibilityMapper.js';

export const hasInsuranceData = (ins) => !!ins && typeof ins === 'object' && Boolean(ins.subscriberId || ins.policyNumber);

export async function loadPractice(tenantId) {
    const r = await query(
        `SELECT t.name AS organization_name, p.npi FROM tenants t LEFT JOIN tenant_profile p ON p.tenant_id = t.id WHERE t.id = $1`,
        [tenantId],
    );
    const row = r.rows[0];
    return row ? { organizationName: row.organization_name, npi: row.npi } : null;
}

async function persist(row) {
    const r = await query(
        `INSERT INTO eligibility_checks (tenant_id, patient_id, insurance_slot, payer_name, trading_partner_service_id, subscriber_id,
            service_type_codes, status, summary, raw_request, raw_response, error, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, checked_at`,
        [row.tenantId, row.patientId, row.slot, row.payerName ?? null, row.tradingPartnerServiceId ?? null, row.subscriberId ?? null,
         row.serviceTypeCodes ?? null, row.status, row.summary ?? null, row.rawRequest ?? null, row.rawResponse ?? null, row.error ?? null, row.createdBy ?? null],
    );
    return r.rows[0];
}

async function runOneSlot({ patient, insurance, slot, practice, serviceTypeCodes, tenantId, userId, patientId }) {
    const base = {
        tenantId, patientId: patientId || null, slot, createdBy: userId ?? null, serviceTypeCodes,
        payerName: insurance?.insuranceCompany ?? null,
        tradingPartnerServiceId: insurance?.tradingPartnerServiceId ?? null,
        subscriberId: insurance?.subscriberId ?? insurance?.policyNumber ?? null,
    };
    const save = async (row) => (patientId ? persist(row) : null);
    const finish = async (row) => {
        const saved = await save(row);
        return { slot, status: row.status, error: row.error, ...(row.summary ?? {}), id: saved?.id ?? null, checkedAt: saved?.checked_at ?? new Date().toISOString() };
    };

    if (!stedi.isEnabled()) return finish({ ...base, status: 'skipped', error: 'Eligibility service not configured (no Stedi API key)' });

    let request;
    try {
        request = buildEligibilityRequest({ patient, insurance, practice: practice ?? {}, serviceTypeCodes });
    } catch (err) {
        return finish({ ...base, status: err.code === 'UNSUPPORTED_PAYER' ? 'unknown' : 'error', error: err.message });
    }
    try {
        const response = await stedi.realtimeEligibility(request);
        const summary = summarizeEligibilityResponse(response);
        return finish({ ...base, tradingPartnerServiceId: request.tradingPartnerServiceId, status: summary.status, summary, rawRequest: request, rawResponse: response, error: summary.errors?.[0] ?? null });
    } catch (err) {
        return finish({ ...base, status: 'error', rawRequest: request, error: err.message });
    }
}

/**
 * Run eligibility for both insurance slots carried in `patientInfo`
 * ({ firstName, lastName, dOB, sex, patientId?, insurance?, secondaryInsurance? }).
 * History is persisted only when patientId is present.
 */
export async function runInline({ patientInfo, tenantId, userId, serviceTypeCodes }) {
    if (!patientInfo) throw new Error('patientInfo is required');
    const slots = [];
    if (hasInsuranceData(patientInfo.insurance)) slots.push({ slot: 'primary', insurance: patientInfo.insurance });
    if (hasInsuranceData(patientInfo.secondaryInsurance)) slots.push({ slot: 'secondary', insurance: patientInfo.secondaryInsurance });
    if (!slots.length) return {};
    const practice = await loadPractice(tenantId);
    const results = await Promise.allSettled(slots.map((s) => runOneSlot({
        patient: patientInfo, insurance: s.insurance, slot: s.slot, practice, serviceTypeCodes, tenantId, userId, patientId: patientInfo.patientId,
    })));
    const out = {};
    results.forEach((r, i) => {
        out[slots[i].slot] = r.status === 'fulfilled' ? r.value : { slot: slots[i].slot, status: 'error', error: r.reason?.message };
    });
    return out;
}

/** Run for a saved patient row (as returned by patientOut) — used right after createPatient. */
export function runForPatient({ patient, tenantId, userId }) {
    return runInline({
        tenantId, userId,
        patientInfo: {
            patientId: patient.id, externalPatientId: patient.mrn, firstName: patient.firstName, lastName: patient.lastName, dOB: patient.dOB, sex: patient.sex,
            insurance: patient.insurance, secondaryInsurance: patient.secondaryInsurance,
        },
    });
}

const checkOut = (r) => ({
    id: r.id, patientId: r.patient_id, slot: r.insurance_slot, payerName: r.payer_name, tradingPartnerServiceId: r.trading_partner_service_id,
    subscriberId: r.subscriber_id, serviceTypeCodes: r.service_type_codes ?? [], status: r.status, error: r.error, checkedAt: r.checked_at,
    ...(r.summary ?? {}),
});

export async function historyByPatient(tenantId, patientId, limit = 20) {
    const r = await query(
        `SELECT id, patient_id, insurance_slot, payer_name, trading_partner_service_id, subscriber_id, service_type_codes, status, error, checked_at, summary
         FROM eligibility_checks WHERE tenant_id = $1 AND patient_id = $2 ORDER BY checked_at DESC LIMIT $3`,
        [tenantId, patientId, limit],
    );
    return r.rows.map(checkOut);
}

export async function getCheck(tenantId, id) {
    const r = await query(`SELECT * FROM eligibility_checks WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!r.rowCount) return null;
    return { ...checkOut(r.rows[0]), rawRequest: r.rows[0].raw_request, rawResponse: r.rows[0].raw_response };
}
