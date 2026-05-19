import type { CreateRadiologyOrderPayload } from '../types/radiologyOrder.types';
import type { RadiologyOrderDraftRecord, RadiologyOrderFormValues } from '../types/radiologyOrderForm.types';
import { buildSpecialInstructionsPayload } from './radiologyMappers';

export const EMPTY_RADIOLOGY_ORDER_FORM: RadiologyOrderFormValues = {
    modality: '',
    bodyRegion: '',
    laterality: '',
    contrast: '',
    clinicalIndication: '',
    icd10Codes: [],
    priority: 'Routine',
    relevantLabValues: '',
    pregnancyStatus: 'Not applicable',
    transportRequired: 'false',
    scheduledForIso: null,
    specialInstructions: '',
};

export type RadiologyOrderFormContext = {
    patientId: string;
    encounterId: string;
    tenantId?: string;
    orderedBy: string;
    orderedByName?: string;
};

export function formValuesToCreatePayload(
    form: RadiologyOrderFormValues,
    ctx: RadiologyOrderFormContext
): CreateRadiologyOrderPayload {
    return {
        patientId: ctx.patientId,
        encounterId: ctx.encounterId,
        tenantId: ctx.tenantId,
        modality: form.modality,
        bodyRegion: form.bodyRegion,
        laterality: form.laterality || undefined,
        contrast: form.contrast || undefined,
        clinicalIndication: form.clinicalIndication.trim(),
        icd10Codes: form.icd10Codes,
        priority: form.priority,
        specialInstructions: buildSpecialInstructionsPayload(
            form.specialInstructions,
            form.relevantLabValues,
            form.pregnancyStatus
        ),
        transportRequired: form.transportRequired === 'true',
        scheduledFor: form.scheduledForIso ?? undefined,
        orderedBy: ctx.orderedBy,
        orderedByName: ctx.orderedByName,
    };
}

export function draftRecordToFormValues(draft: RadiologyOrderDraftRecord): RadiologyOrderFormValues {
    return { ...draft.form };
}

export function formValuesToDraftRecord(
    form: RadiologyOrderFormValues,
    ctx: RadiologyOrderFormContext
): RadiologyOrderDraftRecord {
    return {
        patientId: ctx.patientId,
        encounterId: ctx.encounterId,
        tenantId: ctx.tenantId,
        orderedBy: ctx.orderedBy,
        orderedByName: ctx.orderedByName,
        form: { ...form },
        updatedAt: new Date().toISOString(),
    };
}

export function scheduledForToIso(date: Date | null): string | null {
    if (!date) return null;
    return date.toISOString();
}

export function scheduledForFromIso(iso: string | null | undefined): Date | null {
    if (!iso?.trim()) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function validateCreateImagingOrder(form: RadiologyOrderFormValues): {
    valid: boolean;
    indicationError?: string;
    missingModality?: boolean;
} {
    if (!form.clinicalIndication.trim()) {
        return { valid: false, indicationError: 'Clinical indication is required' };
    }
    if (!form.modality.trim() || !form.bodyRegion.trim()) {
        return { valid: false, missingModality: true };
    }
    return { valid: true };
}

export function formHasDraftContent(form: RadiologyOrderFormValues): boolean {
    return Boolean(
        form.modality.trim() ||
            form.bodyRegion.trim() ||
            form.clinicalIndication.trim() ||
            form.icd10Codes.length > 0 ||
            form.specialInstructions.trim() ||
            form.relevantLabValues.trim() ||
            form.laterality.trim() ||
            form.contrast.trim() ||
            form.scheduledForIso
    );
}
