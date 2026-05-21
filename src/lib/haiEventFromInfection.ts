import type { InfectionRecord } from '../types/infectionControl';
import type { HAIEvent, HAIEventType } from '../types/haiEvent';

export function haiEventFromInfectionChange(
    record: InfectionRecord,
    change: 'created' | 'updated' | 'resolved' | 'isolation' | 'severity' | 'status'
): HAIEvent {
    const base = {
        encounterId: record.encounterId,
        patientId: record.patientId,
        infectionRecordId: record.id,
        infectionType: record.infectionType,
        severity: record.severity,
        status: record.status,
        isolationType: record.isolationType,
        occurredAt: new Date().toISOString(),
        recordedBy: 'Chart (local)',
    };

    const map: Record<typeof change, { eventType: HAIEventType; title: string; description: string }> = {
        created: {
            eventType: 'infection_detected',
            title: 'Infection detected',
            description: record.symptoms || `${record.infectionType} documented on chart`,
        },
        isolation: {
            eventType: 'isolation_started',
            title: 'Isolation started',
            description: `${record.isolationType} precautions`,
        },
        severity: {
            eventType: 'severity_updated',
            title: 'Severity updated',
            description: `Severity set to ${record.severity}`,
        },
        status: {
            eventType: 'status_changed',
            title: 'Status changed',
            description: `Status set to ${record.status}`,
        },
        resolved: {
            eventType: 'infection_resolved',
            title: 'Infection resolved',
            description: record.notes || `${record.infectionType} marked resolved`,
        },
        updated: {
            eventType: 'status_changed',
            title: 'Infection record updated',
            description: record.notes || 'Chart infection record updated',
        },
    };

    const m = map[change];
    return {
        id: `HAI-LOCAL-${Date.now()}`,
        ...base,
        eventType: m.eventType,
        title: m.title,
        description: m.description,
    };
}
