/** GET /api/discharges/readiness/:encounterId — gates final ADT discharge confirm */
export type DischargeFinalizeReadiness = {
    dischargeSummaryCompleted: boolean;
    medicationCompleted: boolean;
    billingCleared: boolean;
    insuranceVerified: boolean;
};
