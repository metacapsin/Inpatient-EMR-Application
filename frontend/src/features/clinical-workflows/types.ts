export interface ClinicalApiResponse<T = unknown> {
    status: string;
    message?: string;
    data?: T;
}

export interface PhysicianNote {
    id?: string;
    patientId: string;
    encounterId: string;
    type: string;
    content: Record<string, string>;
    richText?: string | null;
    status: string;
    signedAt?: string | null;
    versionHistory?: unknown[];
    addenda?: { text: string; createdBy: string; createdAt: string }[];
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
