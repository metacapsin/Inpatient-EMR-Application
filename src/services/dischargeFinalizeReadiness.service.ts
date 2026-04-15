import type { AxiosError } from 'axios';
import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import type { DischargeReadinessView } from '../types/dischargeReadiness';
import { getApiErrorMessage } from '../lib/httpError';
import api from './api';

function asBool(v: unknown): boolean {
    return v === true || v === 'true' || v === 1 || v === '1';
}

function normalizeReadinessPayload(raw: unknown): DischargeFinalizeReadiness | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const data = o.data !== undefined && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : o;
    const dischargeSummaryCompleted = asBool(
        data.dischargeSummaryCompleted ?? data.summaryCompleted ?? data.discharge_summary_completed,
    );
    const medicationCompleted = asBool(data.medicationCompleted ?? data.medicationsCompleted ?? data.medication_completed);
    const insuranceVerified = asBool(data.insuranceVerified ?? data.insurance_verified ?? data.eligibilityVerified);
    return {
        dischargeSummaryCompleted,
        medicationCompleted,
        insuranceVerified,
    };
}

/** When the server has not shipped this route yet, derive non-billing flags from the clinical readiness document. */
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

/**
 * Production: GET /api/discharges/readiness/{encounterId}
 * Fallback: when the endpoint is missing or empty, optionally derive from the clinical discharge hub payload.
 * Billing is never taken from this API — use `snapshot.isBillingReady` from discharge readiness.
 */
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
