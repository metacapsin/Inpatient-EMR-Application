import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import type { DischargeReadinessView } from '../types/dischargeReadiness';
import { deriveFinalizeReadinessFromClinicalView } from '../services/dischargeFinalizeReadiness.service';
import type { ReadinessSnapshot } from './dischargeReadinessValidation';

export function resolveFinalizeGates(
    view: DischargeReadinessView,
    apiGates: DischargeFinalizeReadiness | null | undefined
): DischargeFinalizeReadiness {
    return apiGates ?? deriveFinalizeReadinessFromClinicalView(view);
}

export function dischargeProgressPercent(gates: DischargeFinalizeReadiness): number {
    const parts = [
        gates.dischargeSummaryCompleted,
        gates.medicationCompleted,
        gates.billingCleared,
        gates.insuranceVerified,
    ];
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
    gates: DischargeFinalizeReadiness
): DischargeTabCompletion {
    const chargesCount = snapshot.gates.find((g) => g.id === 'gate-charges-count')?.resolved ?? false;
    const chargesPending = snapshot.gates.find((g) => g.id === 'gate-charges-pending')?.resolved ?? false;
    const nursing = snapshot.gates.find((g) => g.id === 'gate-nursing-checklist')?.resolved ?? false;

    return {
        summary: gates.dischargeSummaryCompleted,
        checklist: nursing,
        charges: chargesCount && chargesPending,
        insurance: gates.insuranceVerified,
        billing: gates.billingCleared,
    };
}
