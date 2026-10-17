/** Optional GET /api/discharges/readiness/:encounterId — non-billing flags only; billing uses clinical snapshot. */
export type DischargeFinalizeReadiness = {
    dischargeSummaryCompleted: boolean;
    medicationCompleted: boolean;
    insuranceVerified: boolean;
};
