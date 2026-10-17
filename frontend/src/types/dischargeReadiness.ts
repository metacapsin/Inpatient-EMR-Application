/** Owner hint for workflow / workqueue routing (not a full RBAC model). */
export type ReadinessOwnerRole = 'provider' | 'nursing' | 'billing' | 'registration' | 'coding';

export type ReadinessGateCategory = 'clinical' | 'operational' | 'financial';

export type ReadinessGateSeverity = 'hard' | 'soft';

export type ReadinessGate = {
    id: string;
    category: ReadinessGateCategory;
    severity: ReadinessGateSeverity;
    message: string;
    resolved: boolean;
    ownerRole: ReadinessOwnerRole;
};

export type DischargeSummaryStatus = 'draft' | 'signed';

/** Legacy row shapes; APIs may return arrays that normalize to multiline text in the client. */
export type DischargeProcedureRow = {
    id: string;
    code: string;
    description: string;
};

export type DischargeDiagnosisRow = {
    id: string;
    code: string;
    description: string;
    isPrincipal: boolean;
};

export type DischargeMedicationRow = {
    id: string;
    name: string;
    sig: string;
};

export type DischargeSummaryState = {
    status: DischargeSummaryStatus;
    admissionDiagnosis: string;
    hospitalCourse: string;
    /** CPT / ICD-10-PCS free text (normalized from string or legacy row[]). */
    procedures: string;
    /** ICD-10-CM narrative lines (normalized from string or legacy row[]). */
    finalDiagnoses: string;
    disposition: string;
    conditionAtDischarge: string;
    /** Discharge med list as free text (normalized from string or legacy row[]). */
    dischargeMedications: string;
    followUpInstructions: string;
    signedAt: string | null;
    signedBy: string | null;
    signedByName?: string | null;
};

export type ChecklistTask = {
    id: string;
    label: string;
    completed: boolean;
    blocksDischarge: boolean;
    notes: string;
};

export type ChargeCategory = 'room_board' | 'pharmacy' | 'lab' | 'radiology' | 'surgery' | 'supplies' | 'other';

export type ChargeLineStatus = 'pending_capture' | 'posted' | 'hold';

export type ChargeLine = {
    id: string;
    category: ChargeCategory;
    description: string;
    serviceDate: string;
    /** CDM / revenue / HCPCS code as applicable */
    serviceCode: string;
    quantity: number;
    unitPrice: number;
    total: number;
    status: ChargeLineStatus;
};

export type EligibilityCheckStatus = 'active' | 'inactive' | 'error' | 'unknown';

export type EligibilityRecord = {
    id: string;
    requestedAt: string;
    /** When present, eligibility is invalid after this instant (ISO-8601). If omitted, client may treat as requestedAt + 24h. */
    expiresAt?: string | null;
    status: EligibilityCheckStatus;
    displaySummary: string;
    planName: string | null;
    memberId: string | null;
    copayNote: string | null;
    deductibleNote: string | null;
    priorAuthRequired: boolean | null;
    errorCode: string | null;
};

export type ClaimPrepStatus = 'not_ready' | 'ready' | 'submitted' | 'denied' | 'paid';

export type ClaimPrepState = {
    status: ClaimPrepStatus;
    principalDxCode: string | null;
    principalDxDescription: string | null;
    procedureCodes: string[];
    totalCharges: number;
    estimatedPatientResponsibility: number;
    claimFrequency: string;
    admissionType: string;
    lastSubmittedAt: string | null;
    payerClaimId: string | null;
};

export type DischargeReadinessEncounterContext = {
    encounterId: string;
    patientId: string | null;
    patientName: string;
    mrn: string;
    admitDate: string;
    locationLabel: string;
    attendingName: string;
    /**
     * Authoritative from ADT / encounter when the API provides it. Claim submit must require `true`.
     * When omitted, the client falls back to `summary.status === 'signed'`.
     */
    dischargeSigned?: boolean;
};

export type DischargeReadinessPayload = {
    context: DischargeReadinessEncounterContext;
    summary: DischargeSummaryState;
    checklist: ChecklistTask[];
    charges: ChargeLine[];
    eligibilityHistory: EligibilityRecord[];
    claimPrep: ClaimPrepState;
};

export type DischargeReadinessView = DischargeReadinessPayload & {
    gates: ReadinessGate[];
    clinicalReady: boolean;
    billingReady: boolean;
};

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; message: string };
