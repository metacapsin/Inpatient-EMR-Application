// USCDI v3 demographic value sets. Standard code systems (CDC Race & Ethnicity, HL7 Birth Sex, SNOMED
// CT US Edition — nationally licensed for use within the US, the same basis US Core implementations
// build on) rather than free text, so these fields can actually round-trip through FHIR Patient
// extensions (us-core-race / us-core-ethnicity / us-core-genderIdentity). Same approach as the UB-04
// disposition codes used elsewhere in this app: a practical subset, not the full code system.

// CDC Race & Ethnicity code system (OMB categories) — used by both race (multi-select) and ethnicity.
/** @type {Record<string, string>} */
export const RACE_CODES = {
    '1002-5': 'American Indian or Alaska Native',
    '2028-9': 'Asian',
    '2054-5': 'Black or African American',
    '2076-8': 'Native Hawaiian or Other Pacific Islander',
    '2106-3': 'White',
    'ASKU': 'Asked but unknown',
    'UNK': 'Unknown',
};

/** @type {Record<string, string>} */
export const ETHNICITY_CODES = {
    '2135-2': 'Hispanic or Latino',
    '2186-5': 'Not Hispanic or Latino',
    'ASKU': 'Asked but unknown',
    'UNK': 'Unknown',
};

// HL7 Birth Sex value set (used in C-CDA/USCDI) — deliberately smaller than administrative `sex`.
/** @type {Record<string, string>} */
export const SEX_AT_BIRTH_CODES = {
    M: 'Male',
    F: 'Female',
    UNK: 'Unknown',
};

// SNOMED CT, the USCDI v3 / ONC-cited gender identity value set.
/** @type {Record<string, string>} */
export const GENDER_IDENTITY_CODES = {
    '446151000124109': 'Identifies as male gender',
    '446141000124107': 'Identifies as female gender',
    '33791000087105': 'Identifies as non-binary gender',
    '407377005': 'Female-to-male transgender',
    '407376001': 'Male-to-female transgender',
    'OTH': 'Other',
    'ASKU': 'Asked but unknown',
    'UNK': 'Unknown',
};

// SNOMED CT, the ONC 2015 Edition SOGI certification value set.
/** @type {Record<string, string>} */
export const SEXUAL_ORIENTATION_CODES = {
    '20430005': 'Heterosexual',
    '38628009': 'Lesbian, gay or homosexual',
    '42035005': 'Bisexual',
    'OTH': 'Other',
    'ASKU': 'Asked but unknown',
    'UNK': 'Unknown',
};

// Not a clinical terminology — a small internal enum, same spirit as this app's other UI-only enums.
/** @type {Record<string, string>} */
export const COMMUNICATION_PREFERENCE_CODES = {
    phone: 'Phone',
    email: 'Email',
    mail: 'Mail',
    portal: 'Patient portal',
    text: 'Text message',
};

/** @type {Record<string, string>} */
export const GUARDIAN_ROLE_CODES = {
    next_of_kin: 'Next of kin',
    legal_guardian: 'Legal guardian',
    power_of_attorney: 'Power of attorney',
    healthcare_proxy: 'Healthcare proxy',
};
