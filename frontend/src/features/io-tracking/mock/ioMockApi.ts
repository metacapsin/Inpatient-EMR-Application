import type { IoAddIntakePayload, IoAddOutputPayload, IoBalanceSummary, IoTimelineRow } from '../types/ioRecord.types';
import { computeMockBalance, recordsToTimelineRows } from './ioMockBalance';
import { addMockRecord, ensureMockEncounterRecords, getMockRecords } from './ioMockStore';

export async function mockGetIoBalance(encounterId: string): Promise<IoBalanceSummary> {
    await mockDelay();
    ensureMockEncounterRecords(encounterId);
    return computeMockBalance(getMockRecords(encounterId));
}

export async function mockGetIoTimeline(encounterId: string): Promise<IoTimelineRow[]> {
    await mockDelay();
    ensureMockEncounterRecords(encounterId);
    return recordsToTimelineRows(getMockRecords(encounterId));
}

export async function mockAddIoRecord(payload: IoAddIntakePayload | IoAddOutputPayload): Promise<unknown> {
    await mockDelay(80);
    addMockRecord(payload);
    return { ok: true, source: 'mock' };
}

/** Synchronous snapshot for React Query cache updates after mock writes. */
export function getMockIoSnapshot(encounterId: string): { balance: IoBalanceSummary; timeline: IoTimelineRow[] } {
    ensureMockEncounterRecords(encounterId);
    const records = getMockRecords(encounterId);
    return {
        balance: computeMockBalance(records),
        timeline: recordsToTimelineRows(records),
    };
}

function mockDelay(ms = 120): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
