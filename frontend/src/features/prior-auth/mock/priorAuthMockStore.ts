import type { PriorAuthDashboardSummary, PriorAuthExpiringItem, PriorAuthRecord } from '../types/priorAuth.types';
import { daysUntilEnd } from '../Prior/priorAuthDates';
import { buildPriorAuthMockSeed } from './priorAuthMockSeed';

const byEncounter = new Map<string, PriorAuthRecord[]>();
const tenantCatalog = new Map<string, PriorAuthRecord[]>();

let idCounter = 0;

export function nextPriorAuthId(): string {
    idCounter += 1;
    return `pa-mock-${Date.now()}-${idCounter}`;
}

function catalogKey(tenantId: string): string {
    return tenantId.trim() || 'tenant-demo-01';
}

function syncTenantCatalog(tenantId: string): void {
    const all: PriorAuthRecord[] = [];
    for (const list of byEncounter.values()) {
        for (const r of list) {
            if (r.tenantId === tenantId) all.push(r);
        }
    }
    tenantCatalog.set(catalogKey(tenantId), all);
}

export function ensureEncounterPriorAuths(
    encounterId: string,
    patientId: string,
    tenantId?: string
): PriorAuthRecord[] {
    const key = encounterId.trim();
    if (!key) return [];
    const tid = catalogKey(tenantId ?? 'tenant-demo-01');
    if (!byEncounter.has(key)) {
        byEncounter.set(key, buildPriorAuthMockSeed(patientId, key, tid));
        syncTenantCatalog(tid);
    }
    return [...byEncounter.get(key)!];
}

export function getEncounterPriorAuths(encounterId: string): PriorAuthRecord[] {
    const key = encounterId.trim();
    return key ? [...(byEncounter.get(key) ?? [])] : [];
}

export function setEncounterPriorAuths(encounterId: string, records: PriorAuthRecord[]): void {
    const key = encounterId.trim();
    if (!key) return;
    byEncounter.set(key, records);
    const tid = records[0]?.tenantId ?? 'tenant-demo-01';
    syncTenantCatalog(tid);
}

export function upsertPriorAuth(record: PriorAuthRecord): PriorAuthRecord {
    const list = getEncounterPriorAuths(record.encounterId);
    const idx = list.findIndex((r) => r.authId === record.authId);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    setEncounterPriorAuths(record.encounterId, list);
    return record;
}

export function findPriorAuth(encounterId: string, authId: string): PriorAuthRecord | undefined {
    return getEncounterPriorAuths(encounterId).find((r) => r.authId === authId);
}

export function listExpiringPriorAuths(tenantId: string, withinDays = 3): PriorAuthExpiringItem[] {
    ensureTenantCatalog(tenantId);
    const now = Date.now();
    const out: PriorAuthExpiringItem[] = [];
    for (const r of tenantCatalog.get(catalogKey(tenantId)) ?? []) {
        if (r.status !== 'Approved') continue;
        const days = daysUntilEnd(r.authEndDate, now);
        if (days === null || days > withinDays) continue;
        out.push({
            authId: r.authId,
            patientId: r.patientId,
            encounterId: r.encounterId,
            patientLabel: r.patientId,
            serviceType: r.serviceType,
            payerName: r.payerName,
            authEndDate: r.authEndDate,
            daysRemaining: days,
        });
    }
    return out.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

function ensureTenantCatalog(tenantId: string): void {
    const key = catalogKey(tenantId);
    if (!tenantCatalog.has(key)) syncTenantCatalog(key);
}

export function dashboardSummaryForTenant(tenantId: string): PriorAuthDashboardSummary {
    ensureTenantCatalog(tenantId);
    const summary: PriorAuthDashboardSummary = {
        notStarted: 0,
        submitted: 0,
        pending: 0,
        approved: 0,
        denied: 0,
        peerToPeerRequested: 0,
        expired: 0,
    };
    for (const r of tenantCatalog.get(catalogKey(tenantId)) ?? []) {
        switch (r.status) {
            case 'Not Started':
                summary.notStarted += 1;
                break;
            case 'Submitted':
                summary.submitted += 1;
                break;
            case 'Pending':
                summary.pending += 1;
                break;
            case 'Approved':
                summary.approved += 1;
                break;
            case 'Denied':
                summary.denied += 1;
                break;
            case 'Peer-to-Peer Requested':
                summary.peerToPeerRequested += 1;
                break;
            case 'Expired':
                summary.expired += 1;
                break;
            default:
                break;
        }
    }
    return summary;
}
