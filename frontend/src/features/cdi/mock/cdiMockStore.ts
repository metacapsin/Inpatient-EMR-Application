import type { CDIWorklistRecord } from '../types/cdi.types';

const TENANT = 'tenant-demo-01';

const seed: CDIWorklistRecord[] = [
    {
        queryId: 'cdi-2001',
        tenantId: TENANT,
        encounterId: 'enc-8801',
        patientId: 'pat-201',
        patientName: 'Helen Carter',
        attendingPhysician: 'Dr. Sarah Chen',
        attendingPhysicianId: 'phys-001',
        los: 6,
        currentDrg: '690',
        currentDrgWeight: 1.12,
        potentialDrg: '689',
        revenueOpportunity: 4200,
        queriesSent: 1,
        queryStatus: 'Open',
        assignCdiSpecialist: 'Alex Rivera',
        queryType: 'CC/MCC Capture',
        clinicalScenario: 'Patient with acute on chronic systolic HF; documentation mentions mild malnutrition without specificity.',
        questionToPhysician: 'Can you clarify severity and acuity of malnutrition to support CC capture?',
        optionsProvided: [
            { id: 'opt-1', text: 'Mild malnutrition, present on admission' },
            { id: 'opt-2', text: 'Moderate malnutrition, present on admission' },
            { id: 'opt-3', text: 'Not clinically supported' },
        ],
        sentTo: 'Dr. Sarah Chen',
        sentToPhysicianId: 'phys-001',
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        sentBy: 'Alex Rivera',
        sentAt: new Date(Date.now() - 86400000).toISOString(),
        physicianResponse: '',
        selectedOptionId: '',
        responseLocked: false,
    },
    {
        queryId: 'cdi-2002',
        tenantId: TENANT,
        encounterId: 'enc-8802',
        patientId: 'pat-202',
        patientName: 'George Lin',
        attendingPhysician: 'Dr. James Okonkwo',
        attendingPhysicianId: 'phys-002',
        los: 4,
        currentDrg: '291',
        currentDrgWeight: 0.98,
        potentialDrg: '290',
        revenueOpportunity: 2800,
        queriesSent: 2,
        queryStatus: 'Answered',
        assignCdiSpecialist: 'Jordan Blake',
        queryType: 'Principal Diagnosis Clarification',
        clinicalScenario: 'Sepsis vs UTI as principal diagnosis; cultures positive for E. coli.',
        questionToPhysician: 'Which condition was the principal reason for admission after workup?',
        optionsProvided: [
            { id: 'opt-1', text: 'Sepsis due to UTI' },
            { id: 'opt-2', text: 'UTI without sepsis' },
        ],
        sentTo: 'Dr. James Okonkwo',
        sentToPhysicianId: 'phys-002',
        dueDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
        sentBy: 'Jordan Blake',
        sentAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        physicianResponse: 'Sepsis due to UTI was principal reason for admission.',
        selectedOptionId: 'opt-1',
        responseLocked: true,
    },
    {
        queryId: 'cdi-2003',
        tenantId: TENANT,
        encounterId: 'enc-8803',
        patientId: 'pat-203',
        patientName: 'Nina Patel',
        attendingPhysician: 'Dr. Maria Lopez',
        attendingPhysicianId: 'phys-003',
        los: 9,
        currentDrg: '470',
        currentDrgWeight: 1.45,
        potentialDrg: '469',
        revenueOpportunity: 6100,
        queriesSent: 0,
        queryStatus: 'Open',
        assignCdiSpecialist: 'Sam Patel',
        queryType: 'Unclear Documentation',
        clinicalScenario: '',
        questionToPhysician: '',
        optionsProvided: [],
        sentTo: '',
        sentToPhysicianId: '',
        dueDate: '',
        sentBy: '',
        sentAt: '',
        physicianResponse: '',
        selectedOptionId: '',
        responseLocked: false,
    },
    {
        queryId: 'cdi-2004',
        tenantId: TENANT,
        encounterId: 'enc-8804',
        patientId: 'pat-204',
        patientName: 'William Okafor',
        attendingPhysician: 'Dr. Robert Kim',
        attendingPhysicianId: 'phys-004',
        los: 3,
        currentDrg: '392',
        currentDrgWeight: 0.87,
        potentialDrg: '391',
        revenueOpportunity: 1900,
        queriesSent: 1,
        queryStatus: 'Closed',
        assignCdiSpecialist: 'Taylor Nguyen',
        queryType: 'POA (Present on Admission) Status',
        clinicalScenario: 'Pressure ulcer documented on day 2; POA status unclear.',
        questionToPhysician: 'Was the pressure ulcer present on admission?',
        optionsProvided: [
            { id: 'opt-1', text: 'Yes, present on admission' },
            { id: 'opt-2', text: 'No, hospital acquired' },
        ],
        sentTo: 'Dr. Robert Kim',
        sentToPhysicianId: 'phys-004',
        dueDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
        sentBy: 'Taylor Nguyen',
        sentAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        physicianResponse: 'Hospital acquired — documented on day 2.',
        selectedOptionId: 'opt-2',
        responseLocked: true,
    },
];

const worklistStore = new Map<string, CDIWorklistRecord[]>();

function key(tenantId: string): string {
    return tenantId.trim() || TENANT;
}

export function ensureCdiWorklist(tenantId: string): CDIWorklistRecord[] {
    const k = key(tenantId);
    if (!worklistStore.has(k)) {
        worklistStore.set(k, seed.map((r) => ({ ...r, tenantId: k })));
    }
    return worklistStore.get(k)!;
}

export function findCdiQuery(tenantId: string, queryId: string): CDIWorklistRecord | undefined {
    return ensureCdiWorklist(tenantId).find((r) => r.queryId === queryId);
}

export function upsertCdiQuery(record: CDIWorklistRecord): void {
    const rows = ensureCdiWorklist(record.tenantId);
    const idx = rows.findIndex((r) => r.queryId === record.queryId);
    if (idx >= 0) rows[idx] = record;
    else rows.unshift(record);
}

export function nextCdiQueryId(): string {
    return `cdi-${Date.now()}`;
}

export function inboxForPhysician(tenantId: string, physicianId: string): CDIWorklistRecord[] {
    return ensureCdiWorklist(tenantId).filter(
        (r) => r.sentToPhysicianId === physicianId && r.sentAt && r.queryStatus !== 'Closed'
    );
}

export function drgForEncounter(encounterId: string): {
    currentDrg: string;
    currentDrgWeight: number;
    potentialDrg: string;
    revenueOpportunity: number;
} {
    const row = [...worklistStore.values()].flat().find((r) => r.encounterId === encounterId);
    if (row) {
        return {
            currentDrg: row.currentDrg,
            currentDrgWeight: row.currentDrgWeight,
            potentialDrg: row.potentialDrg,
            revenueOpportunity: row.revenueOpportunity,
        };
    }
    return {
        currentDrg: '999',
        currentDrgWeight: 1.0,
        potentialDrg: '998',
        revenueOpportunity: 2500,
    };
}
