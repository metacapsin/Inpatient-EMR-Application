/** Consent types supported by the inpatient consent module. */
export type ConsentType =
    | 'General Treatment'
    | 'Surgery'
    | 'Anesthesia'
    | 'Blood Products'
    | 'Research'
    | 'HIPAA NPP'
    | 'Procedure-Specific'
    | 'Telemedicine';

export type ConsentStatus = 'Signed' | 'Pending' | 'Revoked' | 'Expired';

export type SignedByType = 'Patient' | 'Legal Guardian' | 'Healthcare Proxy' | 'Power of Attorney';

export type InterpreterType = 'In-person' | 'Phone' | 'Video';

/** Backend consent model — field names must not be renamed. */
export interface ConsentRecord {
    consentId: string;
    patientId: string;
    encounterId: string;
    tenantId: string;
    consentType: ConsentType;
    procedureName: string | null;
    templateVersion: string;
    templateS3Key: string | null;
    signedByType: SignedByType;
    signedByName: string;
    signedByRelationship: string | null;
    patientHasCapacity: boolean;
    capacityAssessmentNote?: string | null;
    interpreterUsed: boolean;
    interpreterName: string | null;
    interpreterType?: InterpreterType | null;
    languageUsed: string;
    patientSignatureData: string | null;
    witnessSignatureData: string | null;
    witnessId: string | null;
    witnessName: string | null;
    signedAt: string | null;
    status: ConsentStatus;
    expiryDate: string | null;
    revokedAt: string | null;
    revokedReason: string | null;
    signedPdfS3Key: string | null;
    obtainedBy: string | null;
    obtainedByName: string | null;
    /** Linked procedure note id when Procedure-Specific. */
    linkedProcedureNoteId?: string | null;
    updatedAt: string;
}

export interface ConsentCompleteness {
    required: ConsentType[];
    missing: ConsentType[];
    complete: boolean;
}

export interface ConsentSummaryCounts {
    signed: number;
    pending: number;
    revoked: number;
    expired: number;
    missingRequired: number;
}

export type PatientRightsRequestType =
    | 'Access Request'
    | 'Amendment Request'
    | 'Restriction Request'
    | 'Accounting of Disclosures'
    | 'Patient Representative Designation';

export type PatientRightsStatus = 'Pending' | 'In Progress' | 'Completed' | 'Denied';

export interface DisclosureRow {
    id: string;
    date: string;
    disclosedTo: string;
    purpose: string;
    infoDisclosed: string;
}

export interface AccessRequestFields {
    requestType: string;
    dateReceived: string;
    dueDate: string;
    status: PatientRightsStatus;
    fulfillmentDate: string | null;
}

export interface AmendmentRequestFields {
    recordToAmend: string;
    reason: string;
    status: PatientRightsStatus;
    response: string | null;
}

export interface RestrictionRequestFields {
    restrictionTypes: string[];
    specificPayer: string | null;
    status: PatientRightsStatus;
}

export interface RepresentativeDesignationFields {
    name: string;
    relationship: string;
    authorityLevel: string;
}

export interface PatientRightsRecord {
    id: string;
    patientId: string;
    requestType: PatientRightsRequestType;
    createdAt: string;
    updatedAt: string;
    access?: AccessRequestFields;
    amendment?: AmendmentRequestFields;
    restriction?: RestrictionRequestFields;
    disclosures?: DisclosureRow[];
    representative?: RepresentativeDesignationFields;
}

export interface CreateConsentPayload {
    patientId: string;
    encounterId: string;
    tenantId: string;
    consentType: ConsentType;
    procedureName: string | null;
    templateVersion: string;
    templateS3Key: string | null;
    signedByType: SignedByType;
    signedByName: string;
    signedByRelationship: string | null;
    patientHasCapacity: boolean;
    capacityAssessmentNote?: string | null;
    interpreterUsed: boolean;
    interpreterName: string | null;
    interpreterType?: InterpreterType | null;
    languageUsed: string;
    patientSignatureData: string | null;
    witnessSignatureData: string | null;
    witnessId: string | null;
    witnessName: string | null;
    signedAt: string | null;
    status: ConsentStatus;
    expiryDate: string | null;
    revokedAt: string | null;
    revokedReason: string | null;
    signedPdfS3Key: string | null;
    obtainedBy: string | null;
    obtainedByName: string | null;
    linkedProcedureNoteId?: string | null;
}

export interface SignConsentPayload {
    patientSignatureData: string;
    witnessSignatureData: string;
    witnessId: string;
    witnessName: string;
    signedAt: string;
    signedPdfS3Key?: string | null;
}

export interface RevokeConsentPayload {
    revokedReason: string;
}

export interface PatientRightsRequestPayload {
    patientId: string;
    tenantId: string;
    requestType: PatientRightsRequestType;
    access?: AccessRequestFields;
    amendment?: AmendmentRequestFields;
    restriction?: RestrictionRequestFields;
    disclosures?: DisclosureRow[];
    representative?: RepresentativeDesignationFields;
}

export type ServiceResult<T> =
    | { ok: true; data: T }
    | { ok: false; message: string };
