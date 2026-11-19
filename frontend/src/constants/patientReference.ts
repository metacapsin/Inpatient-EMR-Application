/**
 * Static reference data for patient registration (Scope Decision #4 of the registration plan):
 * small, fixed, non-tenant-specific enumerations kept as frontend constants rather than backend endpoints.
 * Option lists mirror the EMR-ng reference form where it defines them; race/ethnicity/language follow
 * the CDC / OMB value sets EMR-ng loads from its settings API.
 */

export interface ReferenceOption {
    value: string;
    label: string;
}

const opts = (values: readonly string[]): ReferenceOption[] => values.map((v) => ({ value: v, label: v }));

export const NAME_PREFIXES: ReferenceOption[] = opts(['Mr.', 'Mrs.', 'Ms.', 'Mx.', 'Dr.', 'Rev.']);

export const NAME_SUFFIXES: ReferenceOption[] = opts(['Jr.', 'Sr.', 'II', 'III', 'IV', 'Esq.', 'MD', 'PhD']);

export const SEX_OPTIONS: ReferenceOption[] = [
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'O', label: 'Other' },
    { value: 'U', label: 'Unknown' },
];

export const MARITAL_STATUSES: ReferenceOption[] = opts([
    'Single',
    'Married',
    'Legally Separated',
    'Domestic Partner',
    'Widowed',
    'Divorced',
    'Other',
]);

export const ADVANCE_DIRECTIVE_STATUSES: ReferenceOption[] = opts([
    'Not Applicable (under 18)',
    'No Advance Directive',
    'Not Completed',
    'In Progress',
    'Completed Copy Available',
    'Completed Copy Not Available',
    'Declined to Provide',
]);

// USCDI v3 demographics — coded (CDC Race & Ethnicity / HL7 Birth Sex / SNOMED CT), matching
// backend/src/lib/uscdiCodes.js exactly so a value saved here round-trips through FHIR Patient
// extensions without a separate label-to-code mapping step.

/** OMB race categories — multi-select (a person may select more than one). */
export const RACES: ReferenceOption[] = [
    { value: '1002-5', label: 'American Indian or Alaska Native' },
    { value: '2028-9', label: 'Asian' },
    { value: '2054-5', label: 'Black or African American' },
    { value: '2076-8', label: 'Native Hawaiian or Other Pacific Islander' },
    { value: '2106-3', label: 'White' },
    { value: 'ASKU', label: 'Asked but unknown' },
    { value: 'UNK', label: 'Unknown' },
];

export const ETHNICITIES: ReferenceOption[] = [
    { value: '2135-2', label: 'Hispanic or Latino' },
    { value: '2186-5', label: 'Not Hispanic or Latino' },
    { value: 'ASKU', label: 'Asked but unknown' },
    { value: 'UNK', label: 'Unknown' },
];

export const SEX_AT_BIRTH_OPTIONS: ReferenceOption[] = [
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'UNK', label: 'Unknown' },
];

export const GENDER_IDENTITIES: ReferenceOption[] = [
    { value: '446151000124109', label: 'Identifies as male gender' },
    { value: '446141000124107', label: 'Identifies as female gender' },
    { value: '33791000087105', label: 'Identifies as non-binary gender' },
    { value: '407377005', label: 'Female-to-male transgender' },
    { value: '407376001', label: 'Male-to-female transgender' },
    { value: 'OTH', label: 'Other' },
    { value: 'ASKU', label: 'Asked but unknown' },
    { value: 'UNK', label: 'Unknown' },
];

export const SEXUAL_ORIENTATIONS: ReferenceOption[] = [
    { value: '20430005', label: 'Heterosexual' },
    { value: '38628009', label: 'Lesbian, gay or homosexual' },
    { value: '42035005', label: 'Bisexual' },
    { value: 'OTH', label: 'Other' },
    { value: 'ASKU', label: 'Asked but unknown' },
    { value: 'UNK', label: 'Unknown' },
];

export const COMMUNICATION_PREFERENCES: ReferenceOption[] = [
    { value: 'phone', label: 'Phone' },
    { value: 'email', label: 'Email' },
    { value: 'mail', label: 'Mail' },
    { value: 'portal', label: 'Patient portal' },
    { value: 'text', label: 'Text message' },
];

export const GUARDIAN_ROLES: ReferenceOption[] = [
    { value: '', label: 'None' },
    { value: 'next_of_kin', label: 'Next of kin' },
    { value: 'legal_guardian', label: 'Legal guardian' },
    { value: 'power_of_attorney', label: 'Power of attorney' },
    { value: 'healthcare_proxy', label: 'Healthcare proxy' },
];

export const PREFERRED_LANGUAGES: ReferenceOption[] = opts([
    'English',
    'Spanish',
    'Chinese (Mandarin)',
    'Chinese (Cantonese)',
    'Tagalog',
    'Vietnamese',
    'Arabic',
    'French',
    'Korean',
    'Russian',
    'German',
    'Hindi',
    'Portuguese',
    'Haitian Creole',
    'Polish',
    'Japanese',
    'Urdu',
    'Persian (Farsi)',
    'Gujarati',
    'Punjabi',
    'American Sign Language',
    'Other',
]);

export const INSURANCE_TYPES: ReferenceOption[] = opts([
    'Employer-Provided',
    'Self-Purchased',
    'Medicare',
    'Medicaid',
    'VA',
    'TRICARE',
    'CHIP',
    'COBRA',
    'Uninsured',
]);

export const INSURANCE_PLAN_TYPES: ReferenceOption[] = opts([
    'HMO (Health Maintenance Organization)',
    'PPO (Preferred Provider Organization)',
    'EPO (Exclusive Provider Organization)',
    'POS (Point of Service Plan)',
    'HDHP (High Deductible Health Plan)',
    'Commercial',
    'Medicare',
    'Medicare Advantage (Part C)',
    'Medicaid / Medi-Cal',
    'Tricare',
    'CHIP (Children’s Health Insurance Program)',
    'Workers’ Compensation',
    'Self-Funded / Self-Insured Plan',
    'Catastrophic Health Insurance',
    'Indemnity / Fee-for-Service',
    'Supplemental Insurance',
]);

export const INSURANCE_STATUSES: ReferenceOption[] = opts(['Active', 'Inactive']);

/** Guarantor relationship. "Self" is removed for minors by the form (age-aware rule ported from EMR-ng). */
export const GUARANTOR_RELATIONSHIPS: ReferenceOption[] = opts(['Self', 'Spouse', 'Parent', 'Other']);

export const EMERGENCY_RELATIONSHIPS: ReferenceOption[] = opts(['Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Other']);

export const US_STATES: ReferenceOption[] = [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
    ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'],
    ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
    ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'],
    ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
    ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
    ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
    ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['PR', 'Puerto Rico'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
    ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
    ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map(([value, label]) => ({ value, label }));

export const COUNTRIES: ReferenceOption[] = opts([
    'United States', 'Afghanistan', 'Argentina', 'Australia', 'Bangladesh', 'Brazil', 'Cambodia', 'Canada', 'Chile', 'China',
    'Colombia', 'Cuba', 'Dominican Republic', 'Egypt', 'El Salvador', 'Ethiopia', 'France', 'Germany', 'Ghana', 'Guatemala',
    'Haiti', 'Honduras', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
    'Kenya', 'Laos', 'Lebanon', 'Mexico', 'Morocco', 'Nepal', 'Netherlands', 'Nicaragua', 'Nigeria', 'Pakistan', 'Peru',
    'Philippines', 'Poland', 'Portugal', 'Russia', 'Saudi Arabia', 'Somalia', 'South Africa', 'South Korea', 'Spain',
    'Sri Lanka', 'Sudan', 'Syria', 'Taiwan', 'Thailand', 'Trinidad and Tobago', 'Turkey', 'Ukraine', 'United Arab Emirates',
    'United Kingdom', 'Venezuela', 'Vietnam', 'Yemen', 'Other',
]);
