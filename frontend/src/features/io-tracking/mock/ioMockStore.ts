import type { IORecord, IoAddIntakePayload, IoAddOutputPayload } from '../types/ioRecord.types';

const recordsByEncounter = new Map<string, IORecord[]>();
const seededEncounters = new Set<string>();

let mockIdCounter = 0;

function nextId(): string {
    mockIdCounter += 1;
    return `io-mock-${Date.now()}-${mockIdCounter}`;
}

function hoursAgo(h: number): string {
    return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function seedRecords(encounterId: string, patientId: string, tenantId: string): IORecord[] {
    return [
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Intake',
            intakeCategory: 'IV Fluid',
            fluidType: 'NS',
            ratePerHour: 125,
            volumeMl: 500,
            recordedAt: hoursAgo(6),
            shift: 'Day',
            notes: 'Mock seed — maintenance IV',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Intake',
            intakeCategory: 'PO (Oral)',
            fluidType: 'Free text',
            volumeMl: 240,
            recordedAt: hoursAgo(4),
            shift: 'Day',
            notes: 'Mock seed — oral fluids',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Output',
            outputCategory: 'Urine',
            colorConsistency: 'Yellow',
            device: 'Foley catheter',
            volumeMl: 180,
            recordedAt: hoursAgo(3),
            shift: 'Day',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Output',
            outputCategory: 'Urine',
            colorConsistency: 'Yellow',
            device: 'Foley catheter',
            volumeMl: 55,
            recordedAt: hoursAgo(0.75),
            shift: 'Day',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Intake',
            intakeCategory: 'IV Fluid',
            fluidType: 'LR',
            ratePerHour: 100,
            volumeMl: 250,
            recordedAt: hoursAgo(8),
            shift: 'Night',
            notes: 'Mock seed — bolus',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Output',
            outputCategory: 'Emesis',
            volumeMl: 120,
            recordedAt: hoursAgo(7),
            shift: 'Night',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Intake',
            intakeCategory: 'PO (Oral)',
            fluidType: 'Water',
            volumeMl: 180,
            recordedAt: hoursAgo(5.5),
            shift: 'Day',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Output',
            outputCategory: 'Urine',
            colorConsistency: 'Amber',
            device: 'Foley catheter',
            volumeMl: 210,
            recordedAt: hoursAgo(5),
            shift: 'Day',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Intake',
            intakeCategory: 'IV Fluid',
            fluidType: 'NS',
            ratePerHour: 80,
            volumeMl: 400,
            recordedAt: hoursAgo(2.5),
            shift: 'Day',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Output',
            outputCategory: 'Drain',
            volumeMl: 45,
            recordedAt: hoursAgo(2),
            shift: 'Day',
            notes: 'Jackson-Pratt',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Output',
            outputCategory: 'Urine',
            colorConsistency: 'Yellow',
            device: 'Foley catheter',
            volumeMl: 90,
            recordedAt: hoursAgo(1.5),
            shift: 'Day',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
        {
            id: nextId(),
            patientId,
            encounterId,
            tenantId,
            recordType: 'Intake',
            intakeCategory: 'Tube feeding',
            fluidType: 'Jevity',
            volumeMl: 200,
            recordedAt: hoursAgo(1),
            shift: 'Day',
            recordedBy: 'mock-nurse',
            recordedByName: 'Demo Nurse, RN',
        },
    ];
}

export function ensureMockEncounterRecords(
    encounterId: string,
    patientId = 'unknown',
    tenantId = 'tenant-demo-01'
): IORecord[] {
    const key = encounterId.trim();
    if (!key) return [];

    if (!recordsByEncounter.has(key) && !seededEncounters.has(key)) {
        seededEncounters.add(key);
        recordsByEncounter.set(key, seedRecords(key, patientId, tenantId));
    }

    return recordsByEncounter.get(key) ?? [];
}

export function getMockRecords(encounterId: string): IORecord[] {
    return [...(recordsByEncounter.get(encounterId.trim()) ?? [])];
}

export function addMockRecord(payload: IoAddIntakePayload | IoAddOutputPayload): IORecord {
    const encounterId = payload.encounterId.trim();
    const existing = ensureMockEncounterRecords(encounterId, payload.patientId, payload.tenantId);

    const record: IORecord =
        payload.recordType === 'Intake'
            ? {
                  id: nextId(),
                  patientId: payload.patientId,
                  encounterId: payload.encounterId,
                  tenantId: payload.tenantId,
                  recordType: 'Intake',
                  intakeCategory: payload.intakeCategory,
                  fluidType: payload.fluidType,
                  ratePerHour: payload.ratePerHour ?? null,
                  bagVolumeRemaining: payload.bagVolumeRemaining ?? null,
                  volumeMl: payload.volumeMl,
                  recordedAt: payload.recordedAt,
                  shift: payload.shift ?? null,
                  notes: payload.notes ?? null,
                  recordedBy: payload.recordedBy,
                  recordedByName: payload.recordedByName,
              }
            : {
                  id: nextId(),
                  patientId: payload.patientId,
                  encounterId: payload.encounterId,
                  tenantId: payload.tenantId,
                  recordType: 'Output',
                  outputCategory: payload.outputCategory,
                  colorConsistency: payload.colorConsistency ?? null,
                  device: payload.device ?? null,
                  volumeMl: payload.volumeMl,
                  recordedAt: payload.recordedAt,
                  shift: payload.shift ?? null,
                  notes: payload.notes ?? null,
                  recordedBy: payload.recordedBy,
                  recordedByName: payload.recordedByName,
              };

    recordsByEncounter.set(encounterId, [...existing, record]);
    return record;
}

/** Dev-only: reset in-memory data for an encounter. */
export function clearMockEncounter(encounterId: string): void {
    const key = encounterId.trim();
    recordsByEncounter.delete(key);
    seededEncounters.delete(key);
}
