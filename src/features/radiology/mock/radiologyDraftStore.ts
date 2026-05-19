import type { RadiologyOrderDraftRecord } from '../types/radiologyOrderForm.types';

const draftsByEncounter = new Map<string, RadiologyOrderDraftRecord>();

function draftKey(encounterId: string): string {
    return encounterId.trim();
}

export function getMockRadiologyDraft(encounterId: string): RadiologyOrderDraftRecord | null {
    const record = draftsByEncounter.get(draftKey(encounterId));
    return record ? { ...record, form: { ...record.form, icd10Codes: [...record.form.icd10Codes] } } : null;
}

export function setMockRadiologyDraft(record: RadiologyOrderDraftRecord): RadiologyOrderDraftRecord {
    const saved = {
        ...record,
        form: { ...record.form, icd10Codes: [...record.form.icd10Codes] },
        updatedAt: new Date().toISOString(),
    };
    draftsByEncounter.set(draftKey(record.encounterId), saved);
    return saved;
}

export function clearMockRadiologyDraft(encounterId: string): void {
    draftsByEncounter.delete(draftKey(encounterId));
}
