import type { IoBalanceSummary } from '../types/ioRecord.types';

const urineByEncounter = new Map<string, number>();
const balanceByEncounter = new Map<string, IoBalanceSummary>();

/** Quality Measures / sepsis workflows can read last-hour urine output without extra API calls. */
export function publishUrineOutputForQuality(encounterId: string, urineOutputLastHourMl: number): void {
    if (!encounterId.trim()) return;
    urineByEncounter.set(encounterId, urineOutputLastHourMl);
}

export function getUrineOutputLastHourForQuality(encounterId: string): number | null {
    const v = urineByEncounter.get(encounterId);
    return v === undefined ? null : v;
}

export function publishIoBalanceForClinical(encounterId: string, summary: IoBalanceSummary): void {
    if (!encounterId.trim()) return;
    balanceByEncounter.set(encounterId, summary);
}

export function getIoBalanceForClinical(encounterId: string): IoBalanceSummary | null {
    return balanceByEncounter.get(encounterId) ?? null;
}
