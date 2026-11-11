// @ts-check
import { mapGender, instant } from './terminology.js';

/**
 * Map an EMR patients row to a FHIR R4 Patient (US Core demographics subset).
 * @param {Record<string, unknown>} row
 * @returns {fhir4.Patient}
 */
export function toFhirPatient(row) {
    const id = String(row.id);
    /** @type {fhir4.HumanName} */
    const name = {
        use: 'official',
        family: String(row.last_name || ''),
        given: [String(row.first_name || ''), row.middle_name ? String(row.middle_name) : undefined].filter(
            /** @returns {v is string} */ (v) => Boolean(v),
        ),
    };
    if (row.prefix) name.prefix = [String(row.prefix)];
    if (row.suffix) name.suffix = [String(row.suffix)];

    /** @type {fhir4.Patient} */
    const resource = {
        resourceType: 'Patient',
        id,
        meta: { lastUpdated: instant(/** @type {string|Date|undefined} */ (row.updated_at || row.created_at)) },
        active: row.is_active !== false,
        identifier: row.mrn
            ? [{ system: 'urn:oid:mrn', value: String(row.mrn), use: 'usual' }]
            : undefined,
        name: [name],
        gender: mapGender(row.sex ? String(row.sex) : undefined),
        birthDate: row.dob ? String(row.dob) : undefined,
        telecom: [],
        address: [],
    };

    if (row.email) resource.telecom?.push({ system: 'email', value: String(row.email) });
    if (row.mobile_phone) resource.telecom?.push({ system: 'phone', value: String(row.mobile_phone), use: 'mobile' });
    if (row.home_phone) resource.telecom?.push({ system: 'phone', value: String(row.home_phone), use: 'home' });
    if (row.work_phone) resource.telecom?.push({ system: 'phone', value: String(row.work_phone), use: 'work' });

    if (row.address1 || row.city || row.state || row.zip_code) {
        resource.address?.push({
            use: 'home',
            line: [row.address1, row.address2].filter(Boolean).map(String),
            city: row.city ? String(row.city) : undefined,
            state: row.state ? String(row.state) : undefined,
            postalCode: row.zip_code ? String(row.zip_code) : undefined,
        });
    }

    if (!resource.telecom?.length) delete resource.telecom;
    if (!resource.address?.length) delete resource.address;
    return resource;
}
