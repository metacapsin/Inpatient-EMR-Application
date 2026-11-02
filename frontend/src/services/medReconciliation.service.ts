import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';

/** Shared medication-line shape (backend lib/medLine.js). */
export interface MedLine {
    name: string;
    rxnormCode?: string;
    dose: string;
    route?: string;
    frequency: string;
    duration?: string;
    instructions?: string;
    quantity?: number | null;
    refills?: number | null;
    source?: 'home' | 'inpatient' | 'discharge' | null;
}

export type ReconciliationType = 'admission' | 'transfer' | 'discharge';
export type ReconciliationAction = 'continue' | 'modify' | 'stop' | 'new';

export interface ReconciliationLine extends MedLine {
    id: string;
    action: ReconciliationAction | null;
    reason: string;
    originalMedicationId: string | null;
}

export interface MedicationReconciliation {
    id: string;
    encounterId: string;
    patientId: string;
    type: ReconciliationType;
    status: 'draft' | 'completed';
    lines: ReconciliationLine[];
    completedBy: string | null;
    completedByName: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface HomeMedication {
    id: string;
    patientId: string;
    name: string;
    dose: string;
    route: string;
    frequency: string;
    instructions: string;
    rxnormCode: string;
    lastTakenAt: string | null;
    reportedBy: string;
    source: 'home';
    isActive: boolean;
    createdAt: string;
}

export type HomeMedicationInput = Partial<Pick<HomeMedication, 'name' | 'dose' | 'route' | 'frequency' | 'instructions' | 'rxnormCode' | 'reportedBy'>> & { name: string };

const unwrap = <T,>(body: unknown): T => (body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: T }).data : (body as T));

export async function listHomeMedications(patientId: string): Promise<HomeMedication[]> {
    const { data } = await api.get(`/api/patients/${encodeURIComponent(patientId)}/home-medications`);
    const raw = unwrap<unknown>(data);
    return Array.isArray(raw) ? (raw as HomeMedication[]) : [];
}

export async function addHomeMedication(patientId: string, body: HomeMedicationInput): Promise<HomeMedication> {
    const { data } = await api.post(`/api/patients/${encodeURIComponent(patientId)}/home-medications`, body);
    return unwrap<HomeMedication>(data);
}

export async function removeHomeMedication(patientId: string, id: string): Promise<void> {
    await api.delete(`/api/patients/${encodeURIComponent(patientId)}/home-medications/${encodeURIComponent(id)}`);
}

export async function listReconciliations(encounterId: string): Promise<MedicationReconciliation[]> {
    const { data } = await api.get(`/api/encounters/${encodeURIComponent(encounterId)}/med-reconciliation`);
    const raw = unwrap<unknown>(data);
    return Array.isArray(raw) ? (raw as MedicationReconciliation[]) : [];
}

export async function getReconciliation(encounterId: string, type: ReconciliationType): Promise<ServiceResult<MedicationReconciliation>> {
    try {
        const { data } = await api.get(`/api/encounters/${encodeURIComponent(encounterId)}/med-reconciliation/${type}`);
        return { ok: true, data: unwrap<MedicationReconciliation>(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not load reconciliation') };
    }
}

export async function saveReconciliation(encounterId: string, type: ReconciliationType, lines: ReconciliationLine[]): Promise<ServiceResult<MedicationReconciliation>> {
    try {
        const { data } = await api.put(`/api/encounters/${encodeURIComponent(encounterId)}/med-reconciliation/${type}`, { lines });
        return { ok: true, data: unwrap<MedicationReconciliation>(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not save reconciliation') };
    }
}

export async function completeReconciliation(encounterId: string, type: ReconciliationType, lines: ReconciliationLine[]): Promise<ServiceResult<MedicationReconciliation>> {
    try {
        const { data } = await api.post(`/api/encounters/${encodeURIComponent(encounterId)}/med-reconciliation/${type}/complete`, { lines });
        return { ok: true, data: unwrap<MedicationReconciliation>(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not complete reconciliation') };
    }
}
