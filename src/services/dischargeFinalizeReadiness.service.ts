import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import type { DischargeReadinessView } from '../types/dischargeReadiness';

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
 * Optional production route (not deployed on current backend): GET /api/discharges/readiness/{encounterId}.
 * Until it exists, gates are derived from the clinical discharge hub payload only.
 */
export async function fetchDischargeFinalizeReadiness(
    encounterId: string,
    clinicalView?: DischargeReadinessView | null,
): Promise<FetchDischargeFinalizeReadinessResult> {
    const id = encounterId.trim();
    if (!id) return { ok: false, message: 'Encounter is required' };

    // --- GET /api/discharges/readiness/:id disabled (route not on backend). Restore try/catch + api.get when shipped. ---
    // try {
    //     const { data } = await api.get<unknown>(`/api/discharges/readiness/${encodeURIComponent(id)}`);
    //     const normalized = normalizeReadinessPayload(data);
    //     if (normalized) return { ok: true, data: normalized, source: 'api' };
    //     if (clinicalView) {
    //         return { ok: true, data: deriveFinalizeReadinessFromClinicalView(clinicalView), source: 'derived' };
    //     }
    //     return { ok: false, message: 'Unexpected readiness response' };
    // } catch (e) {
    //     const ax = e as AxiosError<unknown>;
    //     const status = ax.response?.status;
    //     if (clinicalView && (status === 404 || status === 501)) {
    //         return { ok: true, data: deriveFinalizeReadinessFromClinicalView(clinicalView), source: 'derived' };
    //     }
    //     return { ok: false, message: getApiErrorMessage(e, 'Could not load discharge readiness') };
    // }

    if (clinicalView) {
        return { ok: true, data: deriveFinalizeReadinessFromClinicalView(clinicalView), source: 'derived' };
    }
    return { ok: false, message: 'Could not load discharge readiness' };
}
