import type { HAIEvent, HAIUnitSummary } from '../types/haiEvent';

export const DEFAULT_HAI_UNIT_ID = 'unit-1';

const ENCOUNTER_TIMELINES: Record<string, HAIEvent[]> = {
    ENC001: [
        {
            id: 'HAI-ENC001-01',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF001',
            eventType: 'infection_detected',
            title: 'Infection detected',
            description: 'COVID-19 confirmed via PCR',
            infectionType: 'COVID-19',
            severity: 'High',
            status: 'Active',
            occurredAt: '2026-05-21T08:15:00.000Z',
            recordedBy: 'Dr. A. Sharma',
        },
        {
            id: 'HAI-ENC001-02',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF001',
            eventType: 'isolation_started',
            title: 'Isolation started',
            description: 'Airborne precautions initiated',
            infectionType: 'COVID-19',
            isolationType: 'Airborne',
            severity: 'High',
            status: 'Active',
            occurredAt: '2026-05-21T08:45:00.000Z',
            recordedBy: 'Infection Control Nurse',
        },
        {
            id: 'HAI-ENC001-03',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF002',
            eventType: 'infection_detected',
            title: 'Infection detected',
            description: 'MRSA wound culture positive',
            infectionType: 'MRSA',
            severity: 'Moderate',
            status: 'Monitoring',
            occurredAt: '2026-05-18T14:20:00.000Z',
            recordedBy: 'Microbiology Lab',
        },
        {
            id: 'HAI-ENC001-04',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF002',
            eventType: 'isolation_started',
            title: 'Isolation started',
            description: 'Contact precautions added',
            infectionType: 'MRSA',
            isolationType: 'Contact',
            severity: 'Moderate',
            status: 'Monitoring',
            occurredAt: '2026-05-18T15:00:00.000Z',
            recordedBy: 'Charge Nurse',
        },
        {
            id: 'HAI-ENC001-05',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF002',
            eventType: 'severity_updated',
            title: 'Severity updated',
            description: 'Escalated from Low to Moderate',
            infectionType: 'MRSA',
            severity: 'Moderate',
            status: 'Monitoring',
            occurredAt: '2026-05-19T09:30:00.000Z',
            recordedBy: 'Dr. A. Sharma',
        },
        {
            id: 'HAI-ENC001-06',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF003',
            eventType: 'infection_detected',
            title: 'Infection detected',
            description: 'Hospital-acquired UTI',
            infectionType: 'UTI (Hospital-acquired)',
            severity: 'Low',
            status: 'Active',
            occurredAt: '2026-05-10T11:00:00.000Z',
            recordedBy: 'Dr. Lee',
        },
        {
            id: 'HAI-ENC001-07',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF003',
            eventType: 'status_changed',
            title: 'Status changed',
            description: 'Moved to Monitoring',
            infectionType: 'UTI (Hospital-acquired)',
            severity: 'Low',
            status: 'Monitoring',
            occurredAt: '2026-05-14T16:00:00.000Z',
            recordedBy: 'Infection Control',
        },
        {
            id: 'HAI-ENC001-08',
            encounterId: 'ENC001',
            patientId: 'PAT001',
            infectionRecordId: 'INF003',
            eventType: 'infection_resolved',
            title: 'Infection resolved',
            description: 'Completed antibiotic course; cultures negative',
            infectionType: 'UTI (Hospital-acquired)',
            severity: 'Low',
            status: 'Resolved',
            occurredAt: '2026-05-17T10:00:00.000Z',
            recordedBy: 'Dr. Lee',
        },
    ],
    ENC002: [
        {
            id: 'HAI-ENC002-01',
            encounterId: 'ENC002',
            patientId: 'PAT002',
            infectionRecordId: 'INF004',
            eventType: 'infection_detected',
            title: 'Infection detected',
            description: 'C. difficile toxin positive',
            infectionType: 'C. difficile',
            severity: 'High',
            status: 'Active',
            occurredAt: '2026-05-20T07:30:00.000Z',
            recordedBy: 'Lab',
        },
        {
            id: 'HAI-ENC002-02',
            encounterId: 'ENC002',
            patientId: 'PAT002',
            infectionRecordId: 'INF004',
            eventType: 'isolation_started',
            title: 'Isolation started',
            description: 'Contact isolation; dedicated commode',
            infectionType: 'C. difficile',
            isolationType: 'Contact',
            severity: 'High',
            status: 'Active',
            occurredAt: '2026-05-20T08:00:00.000Z',
            recordedBy: 'EVS Lead',
        },
    ],
};

const UNIT_SUMMARIES: Record<string, HAIUnitSummary> = {
    'unit-1': {
        unitId: 'unit-1',
        unitName: 'Medical Unit A',
        asOf: new Date().toISOString(),
        totalActiveInfections: 4,
        isolationPatients: 3,
        resolvedCases: 12,
        highSeverityCases: 2,
        activeByType: [
            { infectionType: 'COVID-19', count: 1 },
            { infectionType: 'MRSA', count: 1 },
            { infectionType: 'C. difficile', count: 1 },
            { infectionType: 'Influenza', count: 1 },
        ],
    },
    'unit-2': {
        unitId: 'unit-2',
        unitName: 'Surgical Unit B',
        asOf: new Date().toISOString(),
        totalActiveInfections: 2,
        isolationPatients: 1,
        resolvedCases: 8,
        highSeverityCases: 1,
        activeByType: [
            { infectionType: 'Surgical Site Infection', count: 1 },
            { infectionType: 'VRE', count: 1 },
        ],
    },
};

/** In-memory timeline append (demo) when records change locally. */
const dynamicByEncounter = new Map<string, HAIEvent[]>();

export function appendMockHaiEvent(event: HAIEvent): void {
    const key = event.encounterId.trim();
    const list = dynamicByEncounter.get(key) ?? [];
    dynamicByEncounter.set(key, [event, ...list]);
}

export function getMockEncounterTimeline(encounterId: string): HAIEvent[] {
    const key = encounterId.trim();
    const seeded = ENCOUNTER_TIMELINES[key] ?? [];
    const dynamic = dynamicByEncounter.get(key) ?? [];
    return [...dynamic, ...seeded].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
}

export function getMockUnitSummary(unitId: string): HAIUnitSummary {
    const key = unitId.trim() || DEFAULT_HAI_UNIT_ID;
    const base = UNIT_SUMMARIES[key] ?? UNIT_SUMMARIES[DEFAULT_HAI_UNIT_ID];
    const recentEvents = Object.values(ENCOUNTER_TIMELINES)
        .flat()
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 6);
    return {
        ...base,
        unitId: key,
        asOf: new Date().toISOString(),
        recentEvents,
    };
}
