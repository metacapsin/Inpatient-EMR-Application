import type { NursingFlowsheetDocument } from '../types/nursingFlowsheet.types';

export function flowsheetDraftStorageKey(
    doc: Pick<NursingFlowsheetDocument, 'patientId' | 'encounterId' | 'shiftDate' | 'shiftType'>
): string {
    return `nfs-draft:${doc.patientId}:${doc.encounterId}:${doc.shiftDate}:${doc.shiftType}`;
}

export function readDraftFromStorage(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeDraftToStorage(key: string, json: string): void {
    try {
        localStorage.setItem(key, json);
    } catch {
        /* quota / private mode */
    }
}

export function removeDraftFromStorage(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        /* noop */
    }
}
