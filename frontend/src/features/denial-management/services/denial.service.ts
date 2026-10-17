import api from '../../../services/api';
import { getApiErrorMessage } from '../../../lib/httpError';
import type { ServiceResult } from '../../../types/dischargeReadiness';
import type { ClaimDenialRecord, DenialAnalytics, DenialAppeal, DenialStatus } from '../types/denial.types';
import {
    analyticsForTenant,
    ensureDenialWorklist,
    findDenial,
    nextDenialId,
    upsertDenial,
} from '../mock/denialMockStore';

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

/** GET /api/Denial/worklist/:tenantId */
export async function fetchDenialWorklist(tenantId: string): Promise<ServiceResult<ClaimDenialRecord[]>> {
    if (!USE_MOCK) return viaApi(() => api.get(`/api/Denial/worklist/${encodeURIComponent(tenantId)}`));
    await delay(80);
    return { ok: true, data: [...ensureDenialWorklist(tenantId)] };
}

/** POST /api/Denial/create */
export async function createDenial(
    tenantId: string,
    payload: Omit<ClaimDenialRecord, 'denialId' | 'tenantId'>
): Promise<ServiceResult<ClaimDenialRecord>> {
    if (!USE_MOCK) return viaApi(() => api.post('/api/Denial/create', payload));
    await delay();
    const record: ClaimDenialRecord = {
        ...payload,
        denialId: nextDenialId(),
        tenantId: tenantId.trim() || 'tenant-demo-01',
    };
    upsertDenial(record);
    return { ok: true, data: record };
}

/** PUT /api/Denial/:denialId */
export async function updateDenial(
    tenantId: string,
    denialId: string,
    patch: Partial<ClaimDenialRecord>
): Promise<ServiceResult<ClaimDenialRecord>> {
    if (!USE_MOCK) return viaApi(() => api.put(`/api/Denial/${encodeURIComponent(denialId)}`, patch));
    await delay();
    const existing = findDenial(tenantId, denialId);
    if (!existing) return { ok: false, message: 'Denial not found' };
    const merged = { ...existing, ...patch, denialId: existing.denialId, tenantId: existing.tenantId };
    upsertDenial(merged);
    return { ok: true, data: merged };
}

/** POST /api/Denial/:denialId/appeal */
export async function submitDenialAppeal(
    tenantId: string,
    denialId: string,
    appeal: DenialAppeal
): Promise<ServiceResult<ClaimDenialRecord>> {
    if (!USE_MOCK) return viaApi(() => api.post(`/api/Denial/${encodeURIComponent(denialId)}/appeal`, appeal));
    await delay();
    const existing = findDenial(tenantId, denialId);
    if (!existing) return { ok: false, message: 'Denial not found' };
    const letterS3 =
        appeal.appealLetter.trim() && !appeal.letterS3Upload
            ? `s3://mock-emr-appeals/${denialId}/letter-${Date.now()}.html`
            : appeal.letterS3Upload;
    const merged: ClaimDenialRecord = {
        ...existing,
        status: 'Appealed',
        appeal: { ...appeal, letterS3Upload: letterS3 },
    };
    upsertDenial(merged);
    return { ok: true, data: merged };
}

/** PUT /api/Denial/:denialId/writeoff */
export async function writeOffDenial(
    tenantId: string,
    denialId: string,
    writeOffAmount: number,
    writeOffApprovedBy: string
): Promise<ServiceResult<ClaimDenialRecord>> {
    if (!USE_MOCK) {
        return viaApi(() => api.put(`/api/Denial/${encodeURIComponent(denialId)}/writeoff`, { writeOffAmount, writeOffApprovedBy }));
    }
    await delay();
    const existing = findDenial(tenantId, denialId);
    if (!existing) return { ok: false, message: 'Denial not found' };
    const merged: ClaimDenialRecord = {
        ...existing,
        status: 'Written Off',
        appeal: {
            ...existing.appeal,
            writeOffAmount,
            writeOffApprovedBy,
        },
    };
    upsertDenial(merged);
    return { ok: true, data: merged };
}

/** GET /api/Denial/analytics/:tenantId */
export async function fetchDenialAnalytics(tenantId: string): Promise<ServiceResult<DenialAnalytics>> {
    if (!USE_MOCK) return viaApi(() => api.get(`/api/Denial/analytics/${encodeURIComponent(tenantId)}`));
    await delay(60);
    return { ok: true, data: analyticsForTenant(tenantId) };
}

export async function updateDenialStatus(
    tenantId: string,
    denialId: string,
    status: DenialStatus
): Promise<ServiceResult<ClaimDenialRecord>> {
    return updateDenial(tenantId, denialId, { status });
}

export function billingDenialsPath(): string {
    return '/app/billing/denials';
}

export function billingCdiPath(): string {
    return '/app/billing/cdi';
}

export function billingPriorAuthPath(): string {
    return '/app/inpatient/discharge-readiness';
}
    