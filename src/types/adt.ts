export type AdmissionType = 'emergency' | 'elective' | 'urgent';

export type AdtApiSuccess<T> = {
    status: 'success';
    message: string;
    data: T;
    /** Present when server built HL7/FHIR payloads for logging / forwarding */
    adt?: {
        eventType: 'ADT_A01' | 'ADT_A02' | 'ADT_A03';
        patientId: string;
        encounterId: string;
        bedId?: string;
        timestamp: string;
        hl7: string;
        fhir: Record<string, unknown>;
    };
};

export type AdtApiError = {
    status: 'error';
    message: string;
    details?: Record<string, unknown>;
};

/** POST /api/admissions */
export type AdmitRequest = {
    patientId: string;
    bedId: string;
    admissionType?: AdmissionType;
    sourceOfAdmission?: string;
    attendingPhysicianId?: string;
    diagnosis?: string;
};

export type AdmitResponseData = {
    encounter: Record<string, unknown> & { id: string };
};

/** POST /api/transfers */
export type TransferRequest = {
    encounterId: string;
    newBedId: string;
    transferType?: string;
    reason?: string;
};

export type TransferResponseData = {
    encounterId: string;
    currentBedId: string;
    transfer: Record<string, unknown>;
};

/** POST /api/discharges */
export type DischargePhase = 'initiate' | 'confirm';

export type DischargeRequest = {
    phase: DischargePhase;
    encounterId: string;
    disposition?: string;
    dischargeSummary?: string;
};

export type DischargeInitiateData = {
    encounterId: string;
    dischargeInitiatedAt: string;
};

export type DischargeConfirmData = {
    encounterId: string;
    dischargeTimestamp: string;
    patientId: string;
};

/** GET /api/admissions/active — in-progress encounter row (shape varies by backend; id required). */
export type ActiveEncounterRow = Record<string, unknown> & {
    id: string;
};
