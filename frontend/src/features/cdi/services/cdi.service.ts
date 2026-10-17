import api from '../../../services/api';
import { getApiErrorMessage } from '../../../lib/httpError';
import type { ServiceResult } from '../../../types/dischargeReadiness';
import type { CDIQueryFormValues, CDIWorklistRecord, DrgLookupResult } from '../types/cdi.types';
import {
    drgForEncounter,
    ensureCdiWorklist,
    findCdiQuery,
    inboxForPhysician,
    nextCdiQueryId,
    upsertCdiQuery,
} from '../mock/cdiMockStore';

/** Set `VITE_CDI_DENIAL_MOCK=false` to use the Express/PostgreSQL backend instead of the in-memory mock store. */
const USE_MOCK = import.meta.env.VITE_CDI_DENIAL_MOCK !== 'false';

async function viaApi<T>(call: () => Promise<{ data: { data?: T } }>): Promise<ServiceResult<T>> {
    try {
        const res = await call();
        return { ok: true, data: res.data.data as T };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

function delay(ms = 120): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function mockRevenueOpportunity(currentWeight: number, potentialDrg: string): number {
    if (!potentialDrg.trim()) return 0;
    return Math.round((1.15 - currentWeight) * 8500);
}

/** GET /api/CDI/worklist/:tenantId */
export async function fetchCdiWorklist(tenantId: string): Promise<ServiceResult<CDIWorklistRecord[]>> {
    if (!USE_MOCK) return viaApi(() => api.get(`/api/CDI/worklist/${encodeURIComponent(tenantId)}`));
    await delay(80);
    return { ok: true, data: [...ensureCdiWorklist(tenantId)] };
}

/** POST /api/CDI/query/create */
export async function createCdiQuery(
    tenantId: string,
    encounterId: string,
    patientId: string,
    patientName: string,
    attendingPhysician: string,
    attendingPhysicianId: string,
    los: number,
    form: CDIQueryFormValues
): Promise<ServiceResult<CDIWorklistRecord>> {
    if (!USE_MOCK) {
        return viaApi(() =>
            api.post('/api/CDI/query/create', { encounterId, patientId, patientName, attendingPhysician, attendingPhysicianId, los, ...form })
        );
    }
    await delay();
    const record: CDIWorklistRecord = {
        queryId: nextCdiQueryId(),
        tenantId: tenantId.trim() || 'tenant-demo-01',
        encounterId,
        patientId,
        patientName,
        attendingPhysician,
        attendingPhysicianId,
        los,
        currentDrg: form.currentDrg,
        currentDrgWeight: 0,
        potentialDrg: form.potentialDrg,
        revenueOpportunity: form.revenueOpportunity,
        queriesSent: 0,
        queryStatus: 'Open',
        assignCdiSpecialist: '',
        queryType: form.queryType,
        clinicalScenario: form.clinicalScenario,
        questionToPhysician: form.questionToPhysician,
        optionsProvided: form.optionsProvided,
        sentTo: form.sentTo,
        sentToPhysicianId: form.sentToPhysicianId,
        dueDate: form.dueDate,
        sentBy: form.sentBy,
        sentAt: form.sentAt,
        physicianResponse: '',
        selectedOptionId: '',
        responseLocked: false,
    };
    upsertCdiQuery(record);
    return { ok: true, data: record };
}

/** PUT /api/CDI/query/:queryId/send */
export async function sendCdiQuery(
    tenantId: string,
    queryId: string,
    form: CDIQueryFormValues
): Promise<ServiceResult<CDIWorklistRecord>> {
    if (!USE_MOCK) return viaApi(() => api.put(`/api/CDI/query/${encodeURIComponent(queryId)}/send`, form));
    await delay();
    const existing = findCdiQuery(tenantId, queryId);
    if (!existing) return { ok: false, message: 'CDI query not found' };
    const merged: CDIWorklistRecord = {
        ...existing,
        ...form,
        queriesSent: existing.queriesSent + 1,
        queryStatus: 'Open',
        sentAt: form.sentAt || new Date().toISOString(),
    };
    upsertCdiQuery(merged);
    return { ok: true, data: merged };
}

/** GET /api/CDI/query/inbox/:physicianId */
export async function fetchPhysicianCdiInbox(
    tenantId: string,
    physicianId: string
): Promise<ServiceResult<CDIWorklistRecord[]>> {
    if (!USE_MOCK) return viaApi(() => api.get(`/api/CDI/query/inbox/${encodeURIComponent(physicianId)}`));
    await delay(80);
    return { ok: true, data: inboxForPhysician(tenantId, physicianId) };
}

/** PUT /api/CDI/query/:queryId/answer */
export async function answerCdiQuery(
    tenantId: string,
    queryId: string,
    selectedOptionId: string,
    physicianResponse: string
): Promise<ServiceResult<CDIWorklistRecord>> {
    if (!USE_MOCK) {
        return viaApi(() => api.put(`/api/CDI/query/${encodeURIComponent(queryId)}/answer`, { selectedOptionId, physicianResponse }));
    }
    await delay();
    const existing = findCdiQuery(tenantId, queryId);
    if (!existing) return { ok: false, message: 'CDI query not found' };
    const merged: CDIWorklistRecord = {
        ...existing,
        selectedOptionId,
        physicianResponse,
        queryStatus: 'Answered',
        responseLocked: true,
    };
    upsertCdiQuery(merged);
    return { ok: true, data: merged };
}

/** PUT /api/CDI/query/:queryId/close */
export async function closeCdiQuery(tenantId: string, queryId: string): Promise<ServiceResult<CDIWorklistRecord>> {
    if (!USE_MOCK) return viaApi(() => api.put(`/api/CDI/query/${encodeURIComponent(queryId)}/close`));
    await delay();
    const existing = findCdiQuery(tenantId, queryId);
    if (!existing) return { ok: false, message: 'CDI query not found' };
    const merged: CDIWorklistRecord = { ...existing, queryStatus: 'Closed' };
    upsertCdiQuery(merged);
    return { ok: true, data: merged };
}

/** GET /api/CDI/drg/:encounterId */
export async function fetchDrgForEncounter(encounterId: string): Promise<ServiceResult<DrgLookupResult>> {
    // No DRG grouper exists on the backend: return an empty lookup so DRGs are entered manually.
    if (!USE_MOCK) {
        return { ok: true, data: { encounterId, currentDrg: '', currentDrgWeight: 0, potentialDrg: '', revenueOpportunity: 0 } };
    }
    await delay(60);
    const drg = drgForEncounter(encounterId);
    const revenue = mockRevenueOpportunity(drg.currentDrgWeight, drg.potentialDrg);
    return {
        ok: true,
        data: {
            encounterId,
            currentDrg: drg.currentDrg,
            currentDrgWeight: drg.currentDrgWeight,
            potentialDrg: drg.potentialDrg,
            revenueOpportunity: drg.revenueOpportunity || revenue,
        },
    };
}

export async function assignCdiSpecialist(
    tenantId: string,
    queryId: string,
    specialist: string
): Promise<ServiceResult<CDIWorklistRecord>> {
    if (!USE_MOCK) return viaApi(() => api.put(`/api/CDI/query/${encodeURIComponent(queryId)}/assign`, { specialist }));
    await delay(60);
    const existing = findCdiQuery(tenantId, queryId);
    if (!existing) return { ok: false, message: 'CDI query not found' };
    const merged = { ...existing, assignCdiSpecialist: specialist };
    upsertCdiQuery(merged);
    return { ok: true, data: merged };
}

export function billingCdiPath(): string {
    return '/app/billing/cdi';
}

export function clinicalWorkflowsPath(): string {
    return '/app/inpatient/clinical';
}

export function dischargeReadinessPath(patientId?: string, encounterId?: string): string {
    const qs = new URLSearchParams();
    if (patientId?.trim()) qs.set('patientId', patientId.trim());
    if (encounterId?.trim()) qs.set('encounterId', encounterId.trim());
    const q = qs.toString();
    return q ? `/app/inpatient/discharge-readiness?${q}` : '/app/inpatient/discharge-readiness';
}
