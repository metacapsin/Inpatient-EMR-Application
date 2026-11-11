// @ts-check
import { codeable, coding, instant, patientRef, SYSTEMS } from './terminology.js';

/**
 * @param {string | null | undefined} criticality
 * @param {string | null | undefined} severity
 * @returns {fhir4.AllergyIntolerance['criticality'] | undefined}
 */
function mapCriticality(criticality, severity) {
    const c = String(criticality || '').toLowerCase();
    if (c === 'high' || c === 'low' || c === 'unable-to-assess') return /** @type {fhir4.AllergyIntolerance['criticality']} */ (c);
    const s = String(severity || '').toLowerCase();
    if (s === 'severe' || s === 'life-threatening') return 'high';
    if (s === 'moderate' || s === 'mild') return 'low';
    return undefined;
}

/**
 * @param {string | null | undefined} allergyType
 * @returns {fhir4.AllergyIntolerance['category']}
 */
function mapCategory(allergyType) {
    const t = String(allergyType || '').toLowerCase();
    if (t === 'food') return ['food'];
    if (t === 'environmental') return ['environment'];
    if (t === 'biologic') return ['biologic'];
    return ['medication'];
}

/**
 * Map an EMR patient_allergies row to FHIR R4 AllergyIntolerance.
 * @param {Record<string, unknown>} row
 * @returns {fhir4.AllergyIntolerance}
 */
export function toFhirAllergyIntolerance(row) {
    const id = String(row.id);
    const allergen = String(row.allergen || '');
    const rxnorm = row.rxnorm_code ? String(row.rxnorm_code) : '';
    const clinical = String(row.clinical_status || (row.is_active === false ? 'inactive' : 'active'));
    const verification = String(row.verification_status || 'unconfirmed');
    const recordType = String(row.record_type || '').toLowerCase().includes('intoler') ? 'intolerance' : 'allergy';

    /** @type {fhir4.CodeableConcept} */
    const code = rxnorm
        ? { coding: [coding(SYSTEMS.rxnorm, rxnorm, allergen)], text: allergen }
        : { text: allergen };

    /** @type {fhir4.AllergyIntolerance} */
    const resource = {
        resourceType: 'AllergyIntolerance',
        id,
        meta: { lastUpdated: instant(/** @type {string|Date|undefined} */ (row.created_at)) },
        clinicalStatus: codeable(SYSTEMS.allergyClinical, clinical, clinical),
        verificationStatus: codeable(SYSTEMS.allergyVerification, verification, verification),
        type: recordType,
        category: mapCategory(row.allergy_type ? String(row.allergy_type) : undefined),
        criticality: mapCriticality(
            row.criticality ? String(row.criticality) : undefined,
            row.severity ? String(row.severity) : undefined,
        ),
        code,
        patient: patientRef('Patient', String(row.patient_id)),
        onsetDateTime: row.onset_date ? String(row.onset_date) : undefined,
        lastOccurrence: row.last_occurrence_date ? String(row.last_occurrence_date) : undefined,
        note: row.clinical_notes ? [{ text: String(row.clinical_notes) }] : undefined,
        reaction: row.reaction
            ? [
                  {
                      manifestation: String(row.reaction)
                          .split(',')
                          .map((m) => m.trim())
                          .filter(Boolean)
                          .map((text) => ({ text })),
                      severity: mapReactionSeverity(row.severity ? String(row.severity) : undefined),
                      exposureRoute: row.exposure_route
                          ? { text: String(row.exposure_route) }
                          : undefined,
                  },
              ]
            : undefined,
    };
    return resource;
}

/**
 * @param {string | undefined} severity
 * @returns {fhir4.AllergyIntoleranceReaction['severity'] | undefined}
 */
function mapReactionSeverity(severity) {
    const s = String(severity || '').toLowerCase();
    if (s === 'mild') return 'mild';
    if (s === 'moderate') return 'moderate';
    if (s === 'severe' || s === 'life-threatening') return 'severe';
    return undefined;
}
