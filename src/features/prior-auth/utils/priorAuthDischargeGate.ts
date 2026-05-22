import { getEncounterPriorAuths } from '../mock/priorAuthMockStore';
import { daysUntilEnd, parseAuthDate } from './priorAuthDates';

export function isPriorAuthGateResolved(encounterId: string, nowMs: number = Date.now()): boolean {
    const { resolved } = evaluatePriorAuthGate(encounterId, nowMs);
    return resolved;
}

export function evaluatePriorAuthGate(
    encounterId: string,
    nowMs: number = Date.now()
): { resolved: boolean; message: string } {
    const id = encounterId.trim();
    if (!id) {
        return { resolved: false, message: 'Inpatient prior authorization: encounter not linked' };
    }

    const records = getEncounterPriorAuths(id).filter((r) => r.serviceType === 'Inpatient Stay');
    if (records.length === 0) {
        return {
            resolved: false,
            message: 'Inpatient prior authorization is not on file — create and obtain approval on the Prior Auth chart tab',
        };
    }

    const activeApproved = records.find((r) => {
        if (r.status !== 'Approved') return false;
        const end = parseAuthDate(r.authEndDate);
        if (!end) return true;
        return end.getTime() > nowMs;
    });

    if (activeApproved) {
        const days = daysUntilEnd(activeApproved.authEndDate, nowMs);
        if (days !== null && days < 3) {
            return {
                resolved: false,
                message: `Inpatient prior authorization expires in ${days} day(s) — renew or extend before discharge`,
            };
        }
        return { resolved: true, message: 'Inpatient prior authorization is approved and within the auth period' };
    }

    const blocker = records.find((r) =>
        ['Denied', 'Expired', 'Pending', 'Submitted', 'Peer-to-Peer Requested', 'Not Started'].includes(r.status)
    );
    const status = blocker?.status ?? records[0]?.status ?? 'unknown';
    return {
        resolved: false,
        message: `Inpatient prior authorization is not cleared (status: ${status}) — resolve on the Prior Auth chart tab`,
    };
}
