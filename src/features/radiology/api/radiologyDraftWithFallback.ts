import { USE_RADIOLOGY_MOCK } from '../config/radiologyMock.config';
import {
    mockClearRadiologyOrderDraft,
    mockGetRadiologyOrderDraft,
    mockSaveRadiologyOrderDraft,
} from '../mock/radiologyDraftApi';
import type { RadiologyOrderDraftRecord } from '../types/radiologyOrderForm.types';

const DRAFT_STORAGE_PREFIX = 'radiology-order-draft:';

function localDraftKey(encounterId: string): string {
    return `${DRAFT_STORAGE_PREFIX}${encounterId.trim()}`;
}

function readLocalDraft(encounterId: string): RadiologyOrderDraftRecord | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(localDraftKey(encounterId));
        if (!raw) return null;
        return JSON.parse(raw) as RadiologyOrderDraftRecord;
    } catch {
        return null;
    }
}

function writeLocalDraft(record: RadiologyOrderDraftRecord): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(localDraftKey(record.encounterId), JSON.stringify(record));
}

function removeLocalDraft(encounterId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(localDraftKey(encounterId));
}

/** Load in-progress order entry draft for an encounter. */
export async function getRadiologyOrderDraft(encounterId: string): Promise<RadiologyOrderDraftRecord | null> {
    if (!encounterId.trim()) return null;
    if (USE_RADIOLOGY_MOCK) return mockGetRadiologyOrderDraft(encounterId);
    return readLocalDraft(encounterId);
}

/** Persist in-progress order entry draft (no order row until create). */
export async function saveRadiologyOrderDraft(record: RadiologyOrderDraftRecord): Promise<RadiologyOrderDraftRecord> {
    if (USE_RADIOLOGY_MOCK) return mockSaveRadiologyOrderDraft(record);
    writeLocalDraft(record);
    return record;
}

/** Remove draft after create or cancel. */
export async function clearRadiologyOrderDraft(encounterId: string): Promise<void> {
    if (!encounterId.trim()) return;
    if (USE_RADIOLOGY_MOCK) {
        await mockClearRadiologyOrderDraft(encounterId);
        return;
    }
    removeLocalDraft(encounterId);
}
