// @ts-check
import { codeable, coding, instant, patientRef, SYSTEMS } from './terminology.js';

/**
 * @param {string | null | undefined} status
 * @returns {fhir4.MedicationRequest['status']}
 */
function mapRxStatus(status) {
    const s = String(status || '');
    if (s === 'draft') return 'draft';
    if (s === 'cancelled') return 'cancelled';
    if (s === 'dispensed') return 'completed';
    if (s === 'error') return 'entered-in-error';
    if (s === 'signed' || s === 'transmitted' || s === 'printed') return 'active';
    return 'active';
}

/**
 * Map an EMR medications row to FHIR R4 MedicationRequest.
 * @param {Record<string, unknown>} row
 * @returns {fhir4.MedicationRequest}
 */
export function toFhirMedicationRequestFromMedication(row) {
    const id = String(row.id);
    const name = String(row.name || '');
    const rxnorm = row.rxnorm_code ? String(row.rxnorm_code) : '';
    /** @type {fhir4.CodeableConcept} */
    const medCodeable = rxnorm
        ? { coding: [coding(SYSTEMS.rxnorm, rxnorm, name)], text: name }
        : { text: name };

    /** @type {fhir4.MedicationRequest} */
    return {
        resourceType: 'MedicationRequest',
        id,
        meta: { lastUpdated: instant(/** @type {string|Date|undefined} */ (row.created_at)) },
        status: row.is_active === false ? 'stopped' : 'active',
        intent: 'order',
        medicationCodeableConcept: medCodeable,
        subject: patientRef('Patient', String(row.patient_id)),
        authoredOn: instant(/** @type {string|Date|undefined} */ (row.created_at)),
        dosageInstruction: [
            {
                text: [row.dose, row.route, row.frequency, row.instructions].filter(Boolean).map(String).join(' ') || undefined,
                route: row.route ? { text: String(row.route) } : undefined,
                timing: row.frequency ? { code: { text: String(row.frequency) } } : undefined,
            },
        ],
    };
}

/**
 * Map one medicine line from a prescriptions row to FHIR R4 MedicationRequest.
 * Composite id: `{prescriptionId}:{lineIndex}`.
 * @param {Record<string, unknown>} rx prescriptions row
 * @param {Record<string, unknown>} line medicine line (MedLine shape)
 * @param {number} lineIndex
 * @returns {fhir4.MedicationRequest}
 */
export function toFhirMedicationRequestFromPrescriptionLine(rx, line, lineIndex) {
    const id = `${rx.id}:${lineIndex}`;
    const name = String(line.name || line.medicineName || '');
    const rxnorm = line.rxnormCode || line.rxnorm_code ? String(line.rxnormCode || line.rxnorm_code) : '';
    /** @type {fhir4.CodeableConcept} */
    const medCodeable = rxnorm
        ? { coding: [coding(SYSTEMS.rxnorm, rxnorm, name)], text: name }
        : { text: name };

    /** @type {fhir4.MedicationRequest} */
    return {
        resourceType: 'MedicationRequest',
        id,
        meta: { lastUpdated: instant(/** @type {string|Date|undefined} */ (rx.signed_at || rx.ordered_at || rx.created_at)) },
        status: mapRxStatus(rx.status ? String(rx.status) : undefined),
        intent: 'order',
        medicationCodeableConcept: medCodeable,
        subject: patientRef('Patient', String(rx.patient_id)),
        authoredOn: instant(/** @type {string|Date|undefined} */ (rx.signed_at || rx.ordered_at)),
        requester: rx.prescriber_name ? { display: String(rx.prescriber_name) } : undefined,
        dosageInstruction: [
            {
                text: [line.dose, line.route, line.frequency, line.instructions, line.duration]
                    .filter(Boolean)
                    .map(String)
                    .join(' ') || undefined,
                route: line.route ? { text: String(line.route) } : undefined,
                timing: line.frequency ? { code: { text: String(line.frequency) } } : undefined,
            },
        ],
        note: rx.notes ? [{ text: String(rx.notes) }] : undefined,
    };
}
