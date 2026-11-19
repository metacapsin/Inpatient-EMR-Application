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

export interface NoteVersion {
    version: number;
    content: Record<string, string>;
    richText?: string | null;
    title?: string | null;
    checksum: string;
    editedBy: string;
    editedAt: string;
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
    versionHistory?: NoteVersion[];
    addenda?: { text: string; createdBy: string; createdByName?: string | null; createdAt: string }[];
    cmsCompliance?: NoteCmsCompliance | null;
    // BUG-16b: a note touched after its encounter was discharged is a late entry, not an error.
    isLateEntry?: boolean;
    // Co-sign: set when a nurse signed her own progress note — a physician co-signature is required
    // before the record is complete.
    requiresCosign?: boolean;
    cosignedBy?: string | null;
    cosignedByName?: string | null;
    cosignedAt?: string | null;
}

/** Row from GET /api/inpatient/clinical/hp-worklist — active encounters overdue for a signed H&P. */
export interface HpWorklistRow {
    encounterId: string;
    patientId: string;
    patientName: string;
    mrn: string | null;
    admittedAt: string;
    hoursOverdue: number;
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
