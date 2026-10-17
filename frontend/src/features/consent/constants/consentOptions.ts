import type { ConsentType, InterpreterType, SignedByType } from '../../../types/consent';

export const OBTAIN_CONSENT_TYPES: ConsentType[] = [
    'General Treatment',
    'Surgery',
    'Anesthesia',
    'Blood Products',
    'Research',
    'HIPAA NPP',
    'Procedure-Specific',
];

export const ALL_CONSENT_TYPES: ConsentType[] = [
    ...OBTAIN_CONSENT_TYPES,
    'Telemedicine',
];

export const CONSENT_STATUSES = ['Signed', 'Pending', 'Revoked', 'Expired'] as const;

export const SIGNER_TYPES: SignedByType[] = [
    'Patient',
    'Legal Guardian',
    'Healthcare Proxy',
    'Power of Attorney',
];

export const INTERPRETER_TYPES: InterpreterType[] = ['In-person', 'Phone', 'Video'];

export const COMMON_LANGUAGES = [
    'English',
    'Spanish',
    'Mandarin',
    'Vietnamese',
    'Arabic',
    'French',
    'Korean',
    'Russian',
    'Portuguese',
    'Other',
];

export const PATIENT_RIGHTS_STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Denied'] as const;

export const RESTRICTION_TYPE_OPTIONS = [
    'Treatment',
    'Payment',
    'Healthcare operations',
    'Fundraising',
];
