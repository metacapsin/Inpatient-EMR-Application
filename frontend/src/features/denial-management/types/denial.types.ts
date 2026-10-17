export type DenialStatus = 'New' | 'Working' | 'Appealed' | 'Resolved' | 'Written Off';

export type DenialCategory =
    | 'Authorization'
    | 'Coding'
    | 'Clinical'
    | 'Timely Filing'
    | 'Duplicate'
    | 'Eligibility';

export type AppealLevel = 'First Level' | 'Second Level' | 'External Review' | 'Peer-to-Peer';

export type AppealType = 'Written' | 'Verbal' | 'Expedited';

export type AppealOutcome = 'Approved' | 'Partially Approved' | 'Denied' | 'Pending';

export type DenialAppeal = {
    appealLevel: AppealLevel;
    appealType: AppealType;
    supportingClinicalDocuments: string[];
    appealLetter: string;
    letterS3Upload: string;
    submittedDate: string;
    submittedBy: string;
    payerReferenceNumber: string;
    expectedResponseDate: string;
    outcome: AppealOutcome;
    outcomeDate: string;
    approvedAmount: number;
    writeOffAmount: number;
    writeOffApprovedBy: string;
};

export type ClaimDenialRecord = {
    denialId: string;
    tenantId: string;
    claimNumber: string;
    patientId: string;
    patientName: string;
    dateOfService: string;
    payer: string;
    billedAmount: number;
    deniedAmount: number;
    denialCode: string;
    denialReason: string;
    category: DenialCategory;
    appealDeadline: string;
    status: DenialStatus;
    appeal: DenialAppeal;
};

export type DenialAnalytics = {
    denialByCategory: { category: DenialCategory; count: number }[];
    denialRateByPayer: { payer: string; ratePercent: number }[];
    topDenialCodes: { code: string; amount: number }[];
    appealOverturnRatePercent: number;
    monthlyDenialTrend: { month: string; count: number; amount: number }[];
};

export const DENIAL_STATUSES: DenialStatus[] = ['New', 'Working', 'Appealed', 'Resolved', 'Written Off'];

export const DENIAL_CATEGORIES: DenialCategory[] = [
    'Authorization',
    'Coding',
    'Clinical',
    'Timely Filing',
    'Duplicate',
    'Eligibility',
];

export const APPEAL_LEVELS: AppealLevel[] = ['First Level', 'Second Level', 'External Review', 'Peer-to-Peer'];

export const APPEAL_TYPES: AppealType[] = ['Written', 'Verbal', 'Expedited'];

export const APPEAL_OUTCOMES: AppealOutcome[] = ['Approved', 'Partially Approved', 'Denied', 'Pending'];

export function emptyDenialAppeal(submittedBy = ''): DenialAppeal {
    return {
        appealLevel: 'First Level',
        appealType: 'Written',
        supportingClinicalDocuments: [],
        appealLetter: '',
        letterS3Upload: '',
        submittedDate: '',
        submittedBy,
        payerReferenceNumber: '',
        expectedResponseDate: '',
        outcome: 'Pending',
        outcomeDate: '',
        approvedAmount: 0,
        writeOffAmount: 0,
        writeOffApprovedBy: '',
    };
}
