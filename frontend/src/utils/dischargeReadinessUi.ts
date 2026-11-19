import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import type { DischargeReadinessView } from '../types/dischargeReadiness';
import { deriveFinalizeReadinessFromClinicalView } from '../services/dischargeFinalizeReadiness.service';
import { serverGateBlockingMessages } from './dischargeReadinessValidation';

export function resolveFinalizeGates(
    view: DischargeReadinessView,
    apiGates: DischargeFinalizeReadiness | null | undefined,
): DischargeFinalizeReadiness {
    return apiGates ?? deriveFinalizeReadinessFromClinicalView(view);
}

/** Progress for the command strip: resolved server gates over all server gates (signed summary, med rec, checklist, status). */
export function dischargeWorkspaceProgressPercent(view: DischargeReadinessView): number {
    const gates = view.gates;
    if (!gates.length) return view.summary.status === 'signed' ? 50 : 0;
    const resolved = gates.filter((g) => g.resolved).length;
    return Math.round((100 * resolved) / gates.length);
}

export type DischargeTabState = 'done' | 'pending' | 'unavailable' | 'info';

export type DischargeTabCompletion = {
    summary: DischargeTabState;
    checklist: DischargeTabState;
    charges: DischargeTabState;
    insurance: DischargeTabState;
    billing: DischargeTabState;
};

function gateResolved(view: DischargeReadinessView, id: string): boolean | undefined {
    const g = view.gates.find((x) => x.id === id);
    return g ? g.resolved : undefined;
}

export function computeDischargeTabCompletion(view: DischargeReadinessView): DischargeTabCompletion {
    const nursing = gateResolved(view, 'gate-nursing-checklist');
    const hasActiveEligibility = view.eligibilityHistory.some((r) => String(r.status || '').toLowerCase() === 'active');
    return {
        summary: view.summary.status === 'signed' ? 'done' : 'pending',
        checklist: nursing === undefined ? (view.checklist.every((t) => !t.blocksDischarge || t.completed) ? 'done' : 'pending') : nursing ? 'done' : 'pending',
        charges: view.sections?.charges?.available ? 'pending' : 'unavailable',
        // Eligibility is informational: the server does not gate discharge on it.
        insurance: hasActiveEligibility ? 'done' : 'info',
        billing: view.sections?.claimPrep?.available ? 'pending' : 'unavailable',
    };
}

export type DischargeWorkspaceTabId = keyof DischargeTabCompletion;

/** Short lines for the discharge-blocked alert: the server's unresolved gates, verbatim. */
export function getDischargeBlockingFriendlyMessages(view: DischargeReadinessView): string[] {
    return serverGateBlockingMessages(view.gates);
}
