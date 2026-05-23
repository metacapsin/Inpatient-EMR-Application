export type CDIQueryStatus = 'Open' | 'Answered' | 'Closed';

export type CDIQueryType =
    | 'Unclear Documentation'
    | 'CC/MCC Capture'
    | 'Principal Diagnosis Clarification'
    | 'Procedure Clarification'
    | 'POA (Present on Admission) Status'
    | 'Other';

export type CDIQueryOption = {
    id: string;
    text: string;
};

export type CDIWorklistRecord = {
    queryId: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
    patientName: string;
    attendingPhysician: string;
    attendingPhysicianId: string;
    los: number;
    currentDrg: string;
    currentDrgWeight: number;
    potentialDrg: string;
    revenueOpportunity: number;
    queriesSent: number;
    queryStatus: CDIQueryStatus;
    assignCdiSpecialist: string;
    queryType: CDIQueryType;
    clinicalScenario: string;
    questionToPhysician: string;
    optionsProvided: CDIQueryOption[];
    sentTo: string;
    sentToPhysicianId: string;
    dueDate: string;
    sentBy: string;
    sentAt: string;
    physicianResponse: string;
    selectedOptionId: string;
    responseLocked: boolean;
};

export type CDIQueryFormValues = {
    queryType: CDIQueryType;
    clinicalScenario: string;
    questionToPhysician: string;
    optionsProvided: CDIQueryOption[];
    sentTo: string;
    sentToPhysicianId: string;
    dueDate: string;
    currentDrg: string;
    potentialDrg: string;
    revenueOpportunity: number;
    sentBy: string;
    sentAt: string;
};

export type DrgLookupResult = {
    encounterId: string;
    currentDrg: string;
    currentDrgWeight: number;
    potentialDrg: string;
    revenueOpportunity: number;
};

export const CDI_QUERY_STATUSES: CDIQueryStatus[] = ['Open', 'Answered', 'Closed'];

export const CDI_QUERY_TYPES: CDIQueryType[] = [
    'Unclear Documentation',
    'CC/MCC Capture',
    'Principal Diagnosis Clarification',
    'Procedure Clarification',
    'POA (Present on Admission) Status',
    'Other',
];

export const MOCK_PHYSICIANS = [
    { id: 'phys-001', name: 'Dr. Sarah Chen' },
    { id: 'phys-002', name: 'Dr. James Okonkwo' },
    { id: 'phys-003', name: 'Dr. Maria Lopez' },
    { id: 'phys-004', name: 'Dr. Robert Kim' },
];

export const MOCK_CDI_SPECIALISTS = ['Alex Rivera', 'Jordan Blake', 'Sam Patel', 'Taylor Nguyen'];
