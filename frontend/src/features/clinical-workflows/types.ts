export interface ClinicalApiResponse<T = unknown> {
    status: string;
    message?: string;
    data?: T;
}

/** 42 CFR 482.24(c)(4): H&P must be in the record within 24h of admission. Surfaced, never enforced. */
export interface NoteCmsCompliance {
    deadline: string;
    signedAt: string | null;
    isLate: boolean;
    rule: string;
}

export interface PhysicianNote {
    id?: string;
    patientId: string;
    encounterId: string;
    type: string;
    title?: string | null;
    content: Record<string, string>;
    richText?: string | null;
    status: string;
    createdBy?: string;
    createdByName?: string | null;
    signedBy?: string | null;
    signedByName?: string | null;
    signedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    versionHistory?: unknown[];
    addenda?: { text: string; createdBy: string; createdByName?: string | null; createdAt: string }[];
    cmsCompliance?: NoteCmsCompliance | null;
}

/** Inpatient shift nursing documentation (EMR-Backend `nursing_notes`). */
export interface NursingNoteRow {
    id?: string;
    patientId: string;
    encounterId: string;
    nurseId?: string;
    shift: string;
    notes: string;
    createdAt?: string;
    updatedAt?: string;
    vitalsSnapshot?: Record<string, unknown> | null;
    alerts?: unknown;
}

export interface InpatientVitalRow {
    id: string;
    type: string;
    value: number;
    secondaryValue?: number | null;
    unit: string;
    recordedAt: string;
    source?: string;
}

export interface CpoeOrderRow {
    id: string;
    type: string;
    status: string;
    priority: string;
    details: Record<string, unknown>;
    createdAt?: string;
}

export interface ClinicalAlertRow {
    id: string;
    type: string;
    severity: string;
    message: string;
    status: string;
    createdAt?: string;
    triggeredBy?: Record<string, unknown>;
}
