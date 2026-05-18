export type IoRecordType = 'Intake' | 'Output';

export interface IORecord {
    id?: string;
    patientId: string;
    encounterId: string;
    tenantId: string;
    recordType: IoRecordType;
    intakeCategory?: string | null;
    fluidType?: string | null;
    ratePerHour?: number | null;
    bagVolumeRemaining?: number | null;
    outputCategory?: string | null;
    colorConsistency?: string | null;
    device?: string | null;
    volumeMl: number;
    recordedAt: string;
    shift?: string | null;
    notes?: string | null;
    recordedBy: string;
    recordedByName: string;
}

export interface IoBalanceSummary {
    intake8hMl: number;
    output8hMl: number;
    balance8hMl: number;
    intake24hMl: number;
    output24hMl: number;
    balance24hMl: number;
    urineOutputLastHourMl: number;
}

export interface IoTimelineRow {
    id: string;
    timeIso: string;
    recordType: IoRecordType;
    category: string;
    volumeMl: number;
    notes: string;
    recordedByName: string;
}

export interface IoAddIntakePayload {
    patientId: string;
    encounterId: string;
    tenantId: string;
    recordType: 'Intake';
    intakeCategory: string;
    fluidType: string;
    volumeMl: number;
    ratePerHour?: number | null;
    bagVolumeRemaining?: number | null;
    recordedAt: string;
    shift?: string;
    notes?: string;
    recordedBy: string;
    recordedByName: string;
}

export interface IoAddOutputPayload {
    patientId: string;
    encounterId: string;
    tenantId: string;
    recordType: 'Output';
    outputCategory: string;
    volumeMl: number;
    colorConsistency?: string;
    device?: string;
    recordedAt: string;
    shift?: string;
    notes?: string;
    recordedBy: string;
    recordedByName: string;
}
