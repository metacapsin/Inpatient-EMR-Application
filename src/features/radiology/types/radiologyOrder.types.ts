/** Radiology order — API payload and document shape (spec fields only). */

export type RadiologyOrderStatus =
    | 'Ordered'
    | 'Scheduled'
    | 'Patient Arrived'
    | 'In Progress'
    | 'Preliminary'
    | 'Final'
    | 'Amended';

export type RadiologyPriority = 'Routine' | 'Urgent' | 'STAT';

export interface RadiologyOrder {
    _id?: string;
    id?: string;
    orderId?: string;
    patientId: string;
    encounterId: string;
    tenantId?: string;
    modality: string;
    bodyRegion: string;
    laterality?: string;
    contrast?: string;
    clinicalIndication: string;
    icd10Codes: string[];
    priority: RadiologyPriority | string;
    specialInstructions?: string;
    transportRequired?: boolean;
    scheduledFor?: string | null;
    orderedBy: string;
    orderedByName?: string;
    orderedAt?: string;
    status: RadiologyOrderStatus | string;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    performedAt?: string;
    radiologistName?: string;
    radiologistId?: string;
    impression?: string;
    findings?: string;
    criticalValue?: boolean;
    criticalValueNotifiedAt?: string;
    criticalValueNotifiedTo?: string;
    dicomStudyUid?: string;
    dicomViewerUrl?: string;
    resultedAt?: string;
    amendmentReason?: string;
}

export type CreateRadiologyOrderPayload = Pick<
    RadiologyOrder,
    | 'patientId'
    | 'encounterId'
    | 'tenantId'
    | 'modality'
    | 'bodyRegion'
    | 'laterality'
    | 'contrast'
    | 'clinicalIndication'
    | 'icd10Codes'
    | 'priority'
    | 'specialInstructions'
    | 'transportRequired'
    | 'scheduledFor'
    | 'orderedBy'
    | 'orderedByName'
>;

export type RadiologyResultPayload = {
    impression?: string;
    findings?: string;
    radiologistName?: string;
    radiologistId?: string;
    performedAt?: string;
    dicomStudyUid?: string;
    dicomViewerUrl?: string;
    resultedAt?: string;
};

export type RadiologyCriticalPayload = {
    criticalValue: boolean;
    criticalValueNotifiedTo?: string;
};
