// @ts-check
import {
    BP_DIASTOLIC,
    BP_SYSTOLIC,
    VITAL_LOINC,
    codeable,
    coding,
    instant,
    patientRef,
    SYSTEMS,
} from './terminology.js';

/**
 * Map an EMR health_metrics row to FHIR R4 Observation (vital-signs).
 * @param {Record<string, unknown>} row
 * @returns {fhir4.Observation}
 */
export function toFhirVitalObservation(row) {
    const id = `vital-${row.id}`;
    const metric = String(row.metric_type || '');
    const loinc = VITAL_LOINC[metric] || { code: metric, display: metric, unit: String(row.unit || '') };
    const effective = instant(/** @type {string|Date|undefined} */ (row.recorded_at || row.created_at));

    /** @type {fhir4.Observation} */
    const resource = {
        resourceType: 'Observation',
        id,
        meta: { lastUpdated: effective },
        status: 'final',
        category: [codeable(SYSTEMS.observationCategory, 'vital-signs', 'Vital Signs')],
        code: codeable(SYSTEMS.loinc, loinc.code, loinc.display),
        subject: patientRef('Patient', String(row.patient_id)),
        effectiveDateTime: effective,
    };

    if (metric === 'blood_pressure') {
        resource.component = [
            {
                code: codeable(SYSTEMS.loinc, BP_SYSTOLIC.code, BP_SYSTOLIC.display),
                valueQuantity: qty(row.value_primary, row.unit || BP_SYSTOLIC.unit),
            },
            {
                code: codeable(SYSTEMS.loinc, BP_DIASTOLIC.code, BP_DIASTOLIC.display),
                valueQuantity: qty(row.value_secondary, row.unit || BP_DIASTOLIC.unit),
            },
        ];
    } else {
        resource.valueQuantity = qty(row.value_primary, row.unit || loinc.unit);
    }
    return resource;
}

/**
 * Map an EMR lab_results row to FHIR R4 Observation (laboratory).
 * @param {Record<string, unknown>} row
 * @returns {fhir4.Observation}
 */
export function toFhirLabObservation(row) {
    const id = `lab-${row.id}`;
    const name = String(row.test_name || 'Laboratory');
    const loinc = row.loinc_code ? String(row.loinc_code) : '';
    const effective = instant(/** @type {string|Date|undefined} */ (row.resulted_at || row.created_at));

    /** @type {fhir4.CodeableConcept} */
    const code = loinc
        ? { coding: [coding(SYSTEMS.loinc, loinc, name)], text: name }
        : row.test_code
          ? { coding: [{ code: String(row.test_code), display: name }], text: name }
          : { text: name };

    /** @type {fhir4.Observation} */
    const resource = {
        resourceType: 'Observation',
        id,
        meta: { lastUpdated: effective },
        status: mapLabStatus(row.status ? String(row.status) : undefined),
        category: [codeable(SYSTEMS.observationCategory, 'laboratory', 'Laboratory')],
        code,
        subject: patientRef('Patient', String(row.patient_id)),
        effectiveDateTime: effective,
        interpretation: row.abnormal_flag
            ? [codeable('http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', String(row.abnormal_flag))]
            : undefined,
        note: row.comment ? [{ text: String(row.comment) }] : undefined,
    };

    if (row.value_num != null && row.value_num !== '') {
        resource.valueQuantity = qty(row.value_num, row.unit);
    } else if (row.value_text) {
        resource.valueString = String(row.value_text);
    }

    if (row.ref_low != null || row.ref_high != null) {
        resource.referenceRange = [
            {
                low: row.ref_low != null ? qty(row.ref_low, row.unit) : undefined,
                high: row.ref_high != null ? qty(row.ref_high, row.unit) : undefined,
            },
        ];
    }
    return resource;
}

/**
 * @param {string | undefined} status
 * @returns {fhir4.Observation['status']}
 */
function mapLabStatus(status) {
    if (status === 'preliminary') return 'preliminary';
    if (status === 'corrected') return 'corrected';
    return 'final';
}

/**
 * @param {unknown} value
 * @param {unknown} unit
 * @returns {fhir4.Quantity | undefined}
 */
function qty(value, unit) {
    if (value == null || value === '') return undefined;
    const n = Number(value);
    if (Number.isNaN(n)) return undefined;
    /** @type {fhir4.Quantity} */
    const q = { value: n };
    if (unit) {
        q.unit = String(unit);
        q.system = 'http://unitsofmeasure.org';
        q.code = String(unit);
    }
    return q;
}
