/** In-progress imaging order form state (maps to {@link CreateRadiologyOrderPayload} via mappers). */

export interface RadiologyOrderFormValues {
    modality: string;
    bodyRegion: string;
    laterality: string;
    contrast: string;
    clinicalIndication: string;
    icd10Codes: string[];
    priority: string;
    relevantLabValues: string;
    pregnancyStatus: string;
    transportRequired: string;
    scheduledForIso: string | null;
    specialInstructions: string;
}

export interface RadiologyOrderDraftRecord {
    patientId: string;
    encounterId: string;
    tenantId?: string;
    orderedBy: string;
    orderedByName?: string;
    form: RadiologyOrderFormValues;
    updatedAt: string;
}
