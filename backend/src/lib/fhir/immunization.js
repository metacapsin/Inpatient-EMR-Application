// @ts-check
import { instant, patientRef } from './terminology.js';

/**
 * Map an EMR patient_immunizations row to FHIR R4 Immunization.
 * @param {Record<string, unknown>} row
 * @returns {fhir4.Immunization}
 */
export function toFhirImmunization(row) {
    const id = String(row.id);
    const vaccine = String(row.vaccine_name || 'Unknown vaccine');
    const occurrence = row.ordered_date
        ? String(row.ordered_date) + (row.ordered_time ? `T${String(row.ordered_time)}` : '')
        : instant(/** @type {string|Date|undefined} */ (row.created_at)) || new Date().toISOString();

    /** @type {fhir4.Immunization} */
    return {
        resourceType: 'Immunization',
        id,
        meta: { lastUpdated: instant(/** @type {string|Date|undefined} */ (row.created_at)) },
        status: 'completed',
        vaccineCode: {
            text: vaccine,
            coding: row.vaccine_type ? [{ code: String(row.vaccine_type), display: vaccine }] : undefined,
        },
        patient: patientRef('Patient', String(row.patient_id)),
        occurrenceDateTime: occurrence,
        primarySource: true,
        lotNumber: undefined,
        route: row.route ? { text: String(row.route) } : undefined,
        doseQuantity: row.dose
            ? { value: Number.parseFloat(String(row.dose)) || undefined, unit: row.unit ? String(row.unit) : undefined }
            : undefined,
        performer: row.provider ? [{ actor: { display: String(row.provider) } }] : undefined,
        location: row.service_location ? { display: String(row.service_location) } : undefined,
        note: row.comments ? [{ text: String(row.comments) }] : undefined,
        protocolApplied:
            row.number_in_series != null
                ? [{ doseNumberPositiveInt: Number(row.number_in_series) || undefined }]
                : undefined,
    };
}
