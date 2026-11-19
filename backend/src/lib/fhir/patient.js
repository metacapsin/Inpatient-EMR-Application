// @ts-check
import { mapGender, instant, SYSTEMS, US_CORE_EXTENSIONS, NULL_FLAVOR_CODES } from './terminology.js';
import { RACE_CODES, ETHNICITY_CODES, SEX_AT_BIRTH_CODES, GENDER_IDENTITY_CODES } from '../uscdiCodes.js';

/**
 * US Core race/ethnicity extension: one `ombCategory` sub-extension per code, plus a free-text `text`.
 * ASKU/UNK aren't OMB categories — they go in `text` only, matching the US Core IG's own guidance for
 * "declined to answer" style responses.
 * @param {string} url
 * @param {string[]} codes
 * @returns {fhir4.Extension | undefined}
 */
function ombCategoryExtension(url, codes) {
    if (!codes.length) return undefined;
    const labels = (url === US_CORE_EXTENSIONS.race ? RACE_CODES : ETHNICITY_CODES);
    /** @type {fhir4.Extension[]} */
    const sub = [];
    for (const code of codes) {
        if (code === 'ASKU' || code === 'UNK') continue;
        sub.push({ url: 'ombCategory', valueCoding: { system: SYSTEMS.cdcRaceEthnicity, code, display: labels[code] } });
    }
    sub.push({ url: 'text', valueString: codes.map((c) => labels[c]).filter(Boolean).join(', ') });
    return { url, extension: sub };
}

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

    /** @type {fhir4.Extension[]} */
    const extensions = [];
    const race = Array.isArray(row.race) ? /** @type {string[]} */ (row.race) : [];
    const raceExt = ombCategoryExtension(US_CORE_EXTENSIONS.race, race);
    if (raceExt) extensions.push(raceExt);
    if (row.ethnicity) {
        const ethnicityExt = ombCategoryExtension(US_CORE_EXTENSIONS.ethnicity, [String(row.ethnicity)]);
        if (ethnicityExt) extensions.push(ethnicityExt);
    }
    if (row.sex_at_birth && SEX_AT_BIRTH_CODES[String(row.sex_at_birth)]) {
        extensions.push({ url: US_CORE_EXTENSIONS.birthsex, valueCode: String(row.sex_at_birth) });
    }
    if (row.gender_identity && GENDER_IDENTITY_CODES[String(row.gender_identity)]) {
        const code = String(row.gender_identity);
        const system = NULL_FLAVOR_CODES.has(code) ? SYSTEMS.nullFlavor : SYSTEMS.snomed;
        extensions.push({
            url: US_CORE_EXTENSIONS.genderIdentity,
            extension: [{
                url: 'value',
                valueCodeableConcept: { coding: [{ system, code, display: GENDER_IDENTITY_CODES[code] }] },
            }],
        });
    }
    if (extensions.length) resource.extension = extensions;

    return resource;
}
