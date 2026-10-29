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

/** OMB race categories (as used on CMS / CDC demographic captures). */
export const RACES: ReferenceOption[] = opts([
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Other Race',
    'Declined to Specify',
]);

export const ETHNICITIES: ReferenceOption[] = opts(['Hispanic or Latino', 'Not Hispanic or Latino', 'Declined to Specify']);

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
