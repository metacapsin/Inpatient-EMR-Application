import type { ServiceResult } from '../../../types/dischargeReadiness';
import type { ClaimDenialRecord, DenialAnalytics, DenialAppeal, DenialStatus } from '../types/denial.types';
import {
    analyticsForTenant,
    ensureDenialWorklist,
    findDenial,
    nextDenialId,
    upsertDenial,
} from '../mock/denialMockStore';

const USE_MOCK = true;

function delay(ms = 120): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** GET /api/Denial/worklist/:tenantId */
export async function fetchDenialWorklist(tenantId: string): Promise<ServiceResult<ClaimDenialRecord[]>> {
    await delay(80);
    if (!USE_MOCK) {
        // return api.get(`/api/Denial/worklist/${tenantId}`);
    }
    return { ok: true, data: [...ensureDenialWorklist(tenantId)] };
}

/** POST /api/Denial/create */
export async function createDenial(
    tenantId: string,
    payload: Omit<ClaimDenialRecord, 'denialId' | 'tenantId'>
): Promise<ServiceResult<ClaimDenialRecord>> {
    await delay();
    if (!USE_MOCK) {
        // return api.post('/api/Denial/create', { tenantId, ...payload });
    }
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
    