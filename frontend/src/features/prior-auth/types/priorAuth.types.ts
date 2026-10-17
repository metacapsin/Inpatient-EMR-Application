export type PriorAuthServiceType =
    | 'Inpatient Stay'
    | 'Surgical Procedure'
    | 'Imaging'
    | 'Lab'
    | 'DME'
    | 'Post-Acute (SNF/Rehab)'
    | 'Home Health'
    | 'Medication';

export type PriorAuthStatus =
    | 'Not Started'
    | 'Submitted'
    | 'Pending'
    | 'Approved'
    | 'Denied'
    | 'Peer-to-Peer Requested'
    | 'Expired';

export type PriorAuthRecord = {
    authId: string;
    encounterId: string;
    patientId: string;
    tenantId: string;
    serviceType: PriorAuthServiceType;
    serviceDescription: string;
    icd10Codes: string[];
    cptCodes: string[];
    insurancePayer: string;
    payerName: string;
    authNumber: string;
    requestedDate: string;
    authStartDate: string;
    authEndDate: string;
    approvedUnits: number;
    usedUnits: number;
    status: PriorAuthStatus;
    urgentFlag: boolean;
    denialReason: string;
    payerContact: string;
    notes: string;
};

export type PriorAuthFormValues = Omit<PriorAuthRecord, 'authId' | 'encounterId' | 'patientId' | 'tenantId' | 'usedUnits'>;

export type PriorAuthDashboardSummary = {
    notStarted: number;
    submitted: number;
    pending: number;
    approved: number;
    denied: number;
    peerToPeerRequested: number;
    expired: number;
};

export type PriorAuthExpiringItem = {
    authId: string;
    patientId: string;
    encounterId: string;
    patientLabel: string;
    serviceType: PriorAuthServiceType;
    payerName: string;
    authEndDate: string;
    daysRemaining: number;
};
