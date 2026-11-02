import type { AxiosError } from 'axios';
import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import type { DischargeReadinessView } from '../types/dischargeReadiness';

/** Fallback when the server route is unreachable: derive non-billing flags from the clinical readiness document. */
export function deriveFinalizeReadinessFromClinicalView(view: DischargeReadinessView): DischargeFinalizeReadiness {
    const dischargeSummaryCompleted = view.summary.status === 'signed';
    const medTask = view.checklist.find((t) => /medication|reconcil/i.test(t.label));
    const medicationCompleted = medTask ? Boolean(medTask.completed) : false;
    const insuranceVerified =
        Array.isArray(view.eligibilityHistory) &&
        view.eligibilityHistory.some((r) => String(r.status || '').toLowerCase() === 'active');
    return {
        dischargeSummaryCompleted,
        medicationCompleted,
        insuranceVerified,
    };
}

export type FetchDischargeFinalizeReadinessResult =
    | { ok: true; data: DischargeFinalizeReadiness; source: 'api' | 'derived' }
    | { ok: false; message: string };

function normalizeReadinessPayload(raw: unknown): DischargeFinalizeReadiness | null {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    if (!o) return null;
    const inner = o.status === 'success' && o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : o;
    if (typeof inner.dischargeSummaryCompleted !== 'boolean') return null;
    return {
        dischargeSummaryCompleted: inner.dischargeSummaryCompleted,
        medicationCompleted: Boolean(inner.medicationCompleted),
        insuranceVerified: Boolean(inner.insuranceVerified),
        checklistCompleted: typeof inner.checklistCompleted === 'boolean' ? inner.checklistCompleted : undefined,
        blocked: typeof inner.blocked === 'boolean' ? inner.blocked : undefined,
        gates: Array.isArray(inner.gates) ? (inner.gates as DischargeFinalizeReadiness['gates']) : undefined,
    };
}

/** GET /api/discharges/readiness/:encounterId — the server-side hard gates behind POST /api/discharges/confirm. */
export async function fetchDischargeFinalizeReadiness(
    encounterId: string,
    clinicalView?: DischargeReadinessView | null,
): Promise<FetchDischargeFinalizeReadinessResult> {
    const id = encounterId.trim();
    if (!id) return { ok: false, message: 'Encounter is required' };
    try {
        const { data } = await api.get<unknown>(`/api/discharges/readiness/${encodeURIComponent(id)}`);
        const normalized = normalizeReadinessPayload(data);
        if (normalized) return { ok: true, data: normalized, source: 'api' };
        if (clinicalView) {
            return { ok: true, data: deriveFinalizeReadinessFromClinicalView(clinicalView), source: 'derived' };
        }
        return { ok: false, message: 'Unexpected readiness response' };
    } catch (e) {
        const ax = e as AxiosError<unknown>;
        const status = ax.response?.status;
        if (clinicalView && (status === 404 || status === 501)) {
            return { ok: true, data: deriveFinalizeReadinessFromClinicalView(clinicalView), source: 'derived' };
        }
        return { ok: false, message: getApiErrorMessage(e, 'Could not load discharge readiness') };
    }
}
