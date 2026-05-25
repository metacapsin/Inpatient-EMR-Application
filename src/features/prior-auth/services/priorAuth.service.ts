import type {
    PriorAuthDashboardSummary,
    PriorAuthExpiringItem,
    PriorAuthFormValues,
    PriorAuthRecord,
} from '../types/priorAuth.types';
import {
    dashboardSummaryForTenant,
    ensureEncounterPriorAuths,
    findPriorAuth,
    listExpiringPriorAuths,
    nextPriorAuthId,
    upsertPriorAuth,
} from '../mock/priorAuthMockStore';
import { computeUsedUnitsDummy } from '../Prior/priorAuthFormDefaults';
import type { ServiceResult } from '../../../types/dischargeReadiness';

export type PriorAuthUpdatePatch = Partial<
    Pick<
        PriorAuthRecord,
        'status' | 'authNumber' | 'authStartDate' | 'authEndDate' | 'notes' | 'denialReason'
    >
>;

function delay(ms = 120): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** POST /api/PriorAuth/create */
export async function createPriorAuth(args: {
    encounterId: string;
    patientId: string;
    tenantId: string;
    form: PriorAuthFormValues;
}): Promise<ServiceResult<PriorAuthRecord>> {
    await delay();
    const encounterId = args.encounterId.trim();
    const patientId = args.patientId.trim();
    if (!encounterId || !patientId) {
        return { ok: false, message: 'Encounter and patient are required' };
    }
    ensureEncounterPriorAuths(encounterId, patientId, args.tenantId);
    const record: PriorAuthRecord = {
        authId: nextPriorAuthId(),
        encounterId,
        patientId,
        tenantId: args.tenantId.trim() || 'tenant-demo-01',
        ...args.form,
        usedUnits: computeUsedUnitsDummy(args.form.approvedUnits),
    };
    upsertPriorAuth(record);
    return { ok: true, data: record };
}

/** GET /api/PriorAuth/encounter/:encounterId */
export async function getPriorAuthsByEncounter(
    encounterId: string,
    patientId: string,
    tenantId?: string
): Promise<ServiceResult<PriorAuthRecord[]>> {
    await delay(80);
    const id = encounterId.trim();
    if (!id) return { ok: true, data: [] };
    const rows = ensureEncounterPriorAuths(id, patientId.trim(), tenantId);
    return { ok: true, data: rows };
}

/** PUT /api/PriorAuth/:authId */
export async function updatePriorAuth(
    encounterId: string,
    authId: string,
    patch: PriorAuthUpdatePatch,
    form?: PriorAuthFormValues
): Promise<ServiceResult<PriorAuthRecord>> {
    await delay();
    const existing = findPriorAuth(encounterId, authId);
    if (!existing) return { ok: false, message: 'Prior authorization not found' };
    const merged: PriorAuthRecord = {
        ...existing,
        ...(form ?? {}),
        ...patch,
        authId: existing.authId,
        encounterId: existing.encounterId,
        patientId: existing.patientId,
        tenantId: existing.tenantId,
    };
    merged.usedUnits = computeUsedUnitsDummy(form?.approvedUnits ?? merged.approvedUnits);
    upsertPriorAuth(merged);
    return { ok: true, data: merged };
}

/** GET /api/PriorAuth/expiring/:tenantId */
export async function fetchExpiringPriorAuths(tenantId: string): Promise<ServiceResult<PriorAuthExpiringItem[]>> {
    await delay(60);
    return { ok: true, data: listExpiringPriorAuths(tenantId) };
}

/** GET /api/PriorAuth/dashboard/:tenantId */
export async function fetchPriorAuthDashboard(
    tenantId: string
): Promise<ServiceResult<PriorAuthDashboardSummary>> {
    await delay(60);
    return { ok: true, data: dashboardSummaryForTenant(tenantId) };
}

export function facesheetPriorAuthPath(patientId: string): string {
    return `/app/facesheet/${encodeURIComponent(patientId.trim())}/prior-auth`;
}
