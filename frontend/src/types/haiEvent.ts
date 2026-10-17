import type { InfectionSeverity, InfectionStatus } from './infectionControl';

export type HAIEventType =
    | 'infection_detected'
    | 'isolation_started'
    | 'severity_updated'
    | 'status_changed'
    | 'infection_resolved';

export interface HAIEvent {
    id: string;
    encounterId: string;
    patientId?: string;
    infectionRecordId?: string;
    eventType: HAIEventType;
    title: string;
    description?: string;
    infectionType?: string;
    severity?: InfectionSeverity;
    status?: InfectionStatus;
    isolationType?: string;
    occurredAt: string;
    recordedBy?: string;
}

export interface HAIEncounterTimelineResponse {
    encounterId: string;
    events: HAIEvent[];
}

export interface HAIUnitSummary {
    unitId: string;
    unitName: string;
    asOf: string;
    totalActiveInfections: number;
    isolationPatients: number;
    resolvedCases: number;
    highSeverityCases: number;
    activeByType?: { infectionType: string; count: number }[];
    recentEvents?: HAIEvent[];
}
