import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import type { DischargeReadinessView } from '../types/dischargeReadiness';
import { deriveFinalizeReadinessFromClinicalView } from '../services/dischargeFinalizeReadiness.service';
import type { ReadinessSnapshot } from './dischargeReadinessValidation';

export function resolveFinalizeGates(
    view: DischargeReadinessView,
    apiGates: DischargeFinalizeReadiness | null | undefined,
): DischargeFinalizeReadiness {
    return apiGates ?? deriveFinalizeReadinessFromClinicalView(view);
}

/** Progress for the discharge workspace strip: signed summary, clinical, and billing (all from clinical snapshot). */
export function dischargeWorkspaceProgressPercent(
    snapshot: ReadinessSnapshot,
    dischargeSummarySigned: boolean,
): number {
    const parts = [dischargeSummarySigned, snapshot.isClinicalReady, snapshot.isBillingReady];
    return Math.round((100 * parts.filter(Boolean).length) / parts.length);
}

export type DischargeTabCompletion = {
    summary: boolean;
    checklist: boolean;
    charges: boolean;
    insurance: boolean;
    billing: boolean;
};

export function computeDischargeTabCompletion(
    view: DischargeReadinessView,
    snapshot: ReadinessSnapshot,
): DischargeTabCompletion {
    const chargesCount = snapshot.gates.find((g) => g.id === 'gate-charges-count')?.resolved ?? false;
    const chargesPending = snapshot.gates.find((g) => g.id === 'gate-charges-pending')?.resolved ?? false;
    const nursing = snapshot.gates.find((g) => g.id === 'gate-nursing-checklist')?.resolved ?? false;
    const insurance = snapshot.gates.find((g) => g.id === 'gate-eligibility')?.resolved ?? false;

    return {
        summary: view.summary.status === 'signed',
        checklist: nursing,
        charges: chargesCount && chargesPending,
        insurance,
        billing: snapshot.isBillingReady,
    };
}

/** Workspace tabs in strip order — used for discharge-blocked copy. */
export type DischargeWorkspaceTabId = keyof DischargeTabCompletion;

const DISCHARGE_BLOCKING_TAB_ORDER: DischargeWorkspaceTabId[] = [
    'summary',
    'checklist',
    'charges',
    'insurance',
    'billing',
];

const DISCHARGE_BLOCKING_TAB_COPY: Record<DischargeWorkspaceTabId, string> = {
    summary: 'Complete discharge summary',
    checklist: 'Complete nursing checklist',
    charges: 'Add and review charges',
    insurance: 'Verify insurance / eligibility',
    billing: 'Complete billing details',
};

/**
 * Short, actionable lines for the discharge-blocked alert — one per incomplete tab only.
 * Finalize eligibility still uses full gates via {@link getDischargeWorkspaceBlockingMessages}.
 */
export function getDischargeBlockingFriendlyMessages(
    view: DischargeReadinessView,
    snapshot: ReadinessSnapshot,
): string[] {
    const done = computeDischargeTabCompletion(view, snapshot);
    const out: string[] = [];
    for (const tab of DISCHARGE_BLOCKING_TAB_ORDER) {
        if (!done[tab]) out.push(DISCHARGE_BLOCKING_TAB_COPY[tab]);
    }
    return out;
}
