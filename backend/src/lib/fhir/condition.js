// @ts-check
import { codeable, instant, patientRef, SYSTEMS } from './terminology.js';

/**
 * @param {string | null | undefined} status
 * @returns {fhir4.CodeableConcept}
 */
function clinicalStatus(status) {
    /** @type {Record<string, string>} */
    const map = {
        active: 'active',
        inactive: 'inactive',
        resolved: 'resolved',
        entered_in_error: 'inactive',
    };
    const code = map[String(status || 'active')] || 'active';
    return codeable(SYSTEMS.conditionClinical, code, code);
}

/**
 * Map an EMR problems row (+ ICD-10) to FHIR R4 Condition.
 * @param {Record<string, unknown>} row
 * @returns {fhir4.Condition}
 */
export function toFhirCondition(row) {
    const id = String(row.id);
    const code = String(row.icd10_code || '');
    const display = String(row.icd10_description || code);
    /** @type {fhir4.Condition} */
    return {
        resourceType: 'Condition',
        id,
        meta: { lastUpdated: instant(/** @type {string|Date|undefined} */ (row.updated_at || row.created_at)) },
        clinicalStatus: clinicalStatus(row.status ? String(row.status) : undefined),
        verificationStatus: codeable(
            'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            row.status === 'entered_in_error' ? 'entered-in-error' : 'confirmed',
        ),
        category: [codeable('http://terminology.hl7.org/CodeSystem/condition-category', 'problem-list-item', 'Problem List Item')],
        code: codeable(SYSTEMS.icd10, code, display, display),
        subject: patientRef('Patient', String(row.patient_id)),
        onsetDateTime: row.onset_date ? String(row.onset_date) : undefined,
        abatementDateTime: row.resolved_date ? String(row.resolved_date) : undefined,
        recordedDate: instant(/** @type {string|Date|undefined} */ (row.created_at)),
    };
}
