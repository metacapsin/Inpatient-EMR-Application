// @ts-check
/** Shared FHIR coding helpers and US Core / LOINC / RxNorm constants. */

export const SYSTEMS = Object.freeze({
    loinc: 'http://loinc.org',
    snomed: 'http://snomed.info/sct',
    rxnorm: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    icd10: 'http://hl7.org/fhir/sid/icd-10-cm',
    observationCategory: 'http://terminology.hl7.org/CodeSystem/observation-category',
    conditionClinical: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
    allergyClinical: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
    allergyVerification: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
    allergyCriticality: 'http://hl7.org/fhir/allergy-intolerance-criticality',
    docClass: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
    v3ActCode: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    encounterStatus: 'http://hl7.org/fhir/encounter-status',
    administrativeGender: 'http://hl7.org/fhir/administrative-gender',
});

/** @type {Record<string, { code: string, display: string, unit?: string }>} */
export const VITAL_LOINC = {
    blood_pressure: { code: '85354-9', display: 'Blood pressure panel' },
    heart_rate: { code: '8867-4', display: 'Heart rate', unit: '/min' },
    temperature: { code: '8310-5', display: 'Body temperature', unit: 'Cel' },
    oxygen_saturation: { code: '2708-6', display: 'Oxygen saturation', unit: '%' },
    weight: { code: '29463-7', display: 'Body weight', unit: 'kg' },
    height: { code: '8302-2', display: 'Body height', unit: 'cm' },
    respiratory_rate: { code: '9279-1', display: 'Respiratory rate', unit: '/min' },
    glucose: { code: '2339-0', display: 'Glucose', unit: 'mg/dL' },
};

export const BP_SYSTOLIC = { code: '8480-6', display: 'Systolic blood pressure', unit: 'mm[Hg]' };
export const BP_DIASTOLIC = { code: '8462-4', display: 'Diastolic blood pressure', unit: 'mm[Hg]' };

/**
 * @param {string} system
 * @param {string} code
 * @param {string} [display]
 * @returns {fhir4.Coding}
 */
export function coding(system, code, display) {
    /** @type {fhir4.Coding} */
    const c = { system, code };
    if (display) c.display = display;
    return c;
}

/**
 * @param {string} system
 * @param {string} code
 * @param {string} [display]
 * @param {string} [text]
 * @returns {fhir4.CodeableConcept}
 */
export function codeable(system, code, display, text) {
    /** @type {fhir4.CodeableConcept} */
    const cc = { coding: [coding(system, code, display)] };
    if (text || display) cc.text = text || display;
    return cc;
}

/**
 * @param {string} resourceType
 * @param {string} id
 * @returns {fhir4.Reference}
 */
export function patientRef(resourceType, id) {
    return { reference: `${resourceType}/${id}` };
}

/**
 * @param {Date | string | null | undefined} v
 * @returns {string | undefined}
 */
export function instant(v) {
    if (v == null) return undefined;
    if (v instanceof Date) return v.toISOString();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * Map EMR sex codes to FHIR administrative gender.
 * @param {string | null | undefined} sex
 * @returns {fhir4.Patient['gender']}
 */
export function mapGender(sex) {
    if (sex === 'M') return 'male';
    if (sex === 'F') return 'female';
    if (sex === 'O') return 'other';
    return 'unknown';
}
