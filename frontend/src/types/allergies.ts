/** Local enums for Facesheet allergy entry — no external terminology APIs. */

export const ALLERGY_CATEGORIES = ['Drug', 'Food', 'Environmental', 'Biologic', 'Other'] as const;
export type AllergyCategory = (typeof ALLERGY_CATEGORIES)[number];

export const ALLERGY_RECORD_TYPES = ['allergy', 'intolerance'] as const;
export type AllergyRecordType = (typeof ALLERGY_RECORD_TYPES)[number];

export const REACTION_OPTIONS = [
    'Anaphylaxis',
    'Hives',
    'Rash',
    'Itching',
    'Shortness of breath',
    'Nausea',
    'Swelling',
    'Unknown',
] as const;

export const REACTION_SEVERITIES = ['Mild', 'Moderate', 'Severe', 'Life-threatening'] as const;
export type ReactionSeverity = (typeof REACTION_SEVERITIES)[number];

export const CRITICALITIES = ['low', 'high', 'unable-to-assess'] as const;
export type AllergyCriticality = (typeof CRITICALITIES)[number];

export const CLINICAL_STATUSES = ['active', 'inactive', 'resolved'] as const;
export type AllergyClinicalStatus = (typeof CLINICAL_STATUSES)[number];

export const VERIFICATION_STATUSES = ['unconfirmed', 'confirmed', 'refuted', 'entered-in-error'] as const;
export type AllergyVerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const EXPOSURE_ROUTES = [
    'oral',
    'intravenous',
    'intramuscular',
    'subcutaneous',
    'topical',
    'inhalation',
    'other',
    'unknown',
] as const;
export type ExposureRoute = (typeof EXPOSURE_ROUTES)[number];

export const REPORTED_BY_OPTIONS = [
    'patient',
    'family',
    'practitioner',
    'prior-records',
    'pharmacy',
    'other',
] as const;
export type ReportedBy = (typeof REPORTED_BY_OPTIONS)[number];
