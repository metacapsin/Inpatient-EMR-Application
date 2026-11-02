import type { ReadinessGate } from './dischargeReadiness';

/** GET /api/discharges/readiness/:encounterId — server-side discharge gates (also enforced by POST /api/discharges/confirm). */
export type DischargeFinalizeReadiness = {
    dischargeSummaryCompleted: boolean;
    medicationCompleted: boolean;
    insuranceVerified: boolean;
    checklistCompleted?: boolean;
    blocked?: boolean;
    gates?: ReadinessGate[];
};
