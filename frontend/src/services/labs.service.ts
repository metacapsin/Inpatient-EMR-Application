import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';

export type AbnormalFlag = 'N' | 'L' | 'H' | 'LL' | 'HH' | 'A';

export interface LabResultRow {
    id: string;
    labOrderId: string;
    patientId: string;
    testCode: string;
    testName: string;
    loincCode: string;
    valueNum: number | null;
    valueText: string;
    value: string;
    unit: string;
    refLow: number | null;
    refHigh: number | null;
    referenceRange: string;
    abnormalFlag: AbnormalFlag;
    isCritical: boolean;
    status: 'preliminary' | 'final' | 'corrected';
    resultedAt: string | null;
    resultedBy: string | null;
    resultedByName: string | null;
    acknowledgedBy: string | null;
    acknowledgedByName: string | null;
    acknowledgedAt: string | null;
    comment: string;
    /** Only on the critical worklist */
    patientName?: string;
    mrn?: string;
    locationLabel?: string;
    accessionNumber?: string;
}

export interface LabResultInput {
    testCode?: string;
    testName: string;
    loincCode?: string;
    valueNum?: number | null;
    valueText?: string;
    unit?: string;
    refLow?: number | null;
    refHigh?: number | null;
    abnormalFlag?: AbnormalFlag;
    isCritical?: boolean;
    status?: 'preliminary' | 'final';
    comment?: string;
}

const unwrap = <T,>(body: unknown): T => (body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: T }).data : (body as T));
const list = (raw: unknown): LabResultRow[] => (Array.isArray(raw) ? (raw as LabResultRow[]) : []);

export async function collectSpecimen(orderId: string, body: { specimenType?: string } = {}): Promise<ServiceResult<{ orderStatus: string; accessionNumber: string; specimenType: string | null; collectedAt: string }>> {
    try {
        const { data } = await api.post(`/lab-orders/${encodeURIComponent(orderId)}/collect`, body);
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not record specimen collection') };
    }
}

export async function enterResults(orderId: string, results: LabResultInput[]): Promise<ServiceResult<{ orderId: string; orderStatus: string; results: LabResultRow[] }>> {
    try {
        const { data } = await api.post(`/lab-orders/${encodeURIComponent(orderId)}/results`, { results });
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not save results') };
    }
}

export async function listOrderResults(orderId: string): Promise<LabResultRow[]> {
    const { data } = await api.get(`/lab-orders/${encodeURIComponent(orderId)}/results`);
    return list(unwrap(data));
}

export async function listPatientResults(patientId: string): Promise<LabResultRow[]> {
    const { data } = await api.get(`/lab-results/by-patient/${encodeURIComponent(patientId)}`);
    return list(unwrap(data));
}

export async function listCriticalResults(): Promise<LabResultRow[]> {
    const { data } = await api.get('/lab-results/critical');
    return list(unwrap(data));
}

export async function acknowledgeResult(resultId: string): Promise<ServiceResult<LabResultRow>> {
    try {
        const { data } = await api.post(`/lab-results/${encodeURIComponent(resultId)}/acknowledge`, {});
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not acknowledge result') };
    }
}

export async function updateLabOrderStatus(orderId: string, orderStatus: 'Collected' | 'In Progress' | 'Resulted' | 'Cancelled'): Promise<ServiceResult<unknown>> {
    try {
        const { data } = await api.put(`/lab-orders/${encodeURIComponent(orderId)}`, { orderStatus });
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not update lab order') };
    }
}

export function flagLabel(flag: AbnormalFlag | string): string {
    switch (flag) {
        case 'L': return 'Low';
        case 'H': return 'High';
        case 'LL': return 'Critical low';
        case 'HH': return 'Critical high';
        case 'A': return 'Abnormal';
        default: return 'Normal';
    }
}

export function flagClass(flag: AbnormalFlag | string, isCritical?: boolean): string {
    if (isCritical || flag === 'LL' || flag === 'HH') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    if (flag === 'L' || flag === 'H' || flag === 'A') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
}
