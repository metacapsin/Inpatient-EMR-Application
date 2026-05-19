import type { RadiologyOrderDraftRecord } from '../types/radiologyOrderForm.types';
import {
    clearMockRadiologyDraft,
    getMockRadiologyDraft,
    setMockRadiologyDraft,
} from './radiologyDraftStore';

export async function mockGetRadiologyOrderDraft(encounterId: string): Promise<RadiologyOrderDraftRecord | null> {
    return getMockRadiologyDraft(encounterId);
}

export async function mockSaveRadiologyOrderDraft(record: RadiologyOrderDraftRecord): Promise<RadiologyOrderDraftRecord> {
    return setMockRadiologyDraft(record);
}

export async function mockClearRadiologyOrderDraft(encounterId: string): Promise<void> {
    clearMockRadiologyDraft(encounterId);
}
