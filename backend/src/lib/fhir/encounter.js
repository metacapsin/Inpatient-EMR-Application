// @ts-check
import { codeable, instant, patientRef, SYSTEMS } from './terminology.js';

/**
 * @param {string | null | undefined} status
 * @returns {fhir4.Encounter['status']}
 */
function mapStatus(status) {
    if (status === 'admitted') return 'in-progress';
    if (status === 'discharge_initiated') return 'in-progress';
    if (status === 'discharged') return 'finished';
    return 'unknown';
}

/**
 * Map an EMR encounters row to FHIR R4 Encounter.
 * @param {Record<string, unknown>} row
 * @returns {fhir4.Encounter}
 */
export function toFhirEncounter(row) {
    const id = String(row.id);
    const patientId = String(row.patient_id);
    /** @type {fhir4.Encounter} */
    const resource = {
        resourceType: 'Encounter',
        id,
        meta: { lastUpdated: instant(/** @type {string|Date|undefined} */ (row.discharged_at || row.admitted_at || row.created_at)) },
        status: mapStatus(row.status ? String(row.status) : undefined),
        class: codeable(SYSTEMS.v3ActCode, 'IMP', 'inpatient encounter').coding?.[0] || {
            system: SYSTEMS.v3ActCode,
            code: 'IMP',
            display: 'inpatient encounter',
        },

        type: row.admission_type
            ? [codeable(SYSTEMS.v3ActCode, String(row.admission_type), String(row.admission_type))]
            : undefined,
        subject: patientRef('Patient', patientId),
        period: {
            start: instant(/** @type {string|Date|undefined} */ (row.admitted_at)),
            end: row.discharged_at ? instant(/** @type {string|Date} */ (row.discharged_at)) : undefined,
        },
        reasonCode: row.diagnosis ? [{ text: String(row.diagnosis) }] : undefined,
    };
    return resource;
}
