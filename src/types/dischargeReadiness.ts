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
    procedures: DischargeProcedureRow[];
    finalDiagnoses: DischargeDiagnosisRow[];
    disposition: string;
    conditionAtDischarge: string;
    dischargeMedications: DischargeMedicationRow[];
    followUpInstructions: string;
    signedAt: string | null;
    signedBy: string | null;
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
