import type { PriorAuthServiceType, PriorAuthStatus } from '../types/priorAuth.types';

export const PRIOR_AUTH_SERVICE_TYPES: PriorAuthServiceType[] = [
    'Inpatient Stay',
    'Surgical Procedure',
    'Imaging',
    'Lab',
    'DME',
    'Post-Acute (SNF/Rehab)',
    'Home Health',
    'Medication',
];

export const PRIOR_AUTH_STATUSES: PriorAuthStatus[] = [
    'Not Started',
    'Submitted',
    'Pending',
    'Approved',
    'Denied',
    'Peer-to-Peer Requested',
    'Expired',
];

export const COMMON_CPT_SUGGESTIONS: { code: string; label: string }[] = [
    { code: '99223', label: 'Initial hospital care, high MDM' },
    { code: '99232', label: 'Subsequent hospital care, moderate MDM' },
    { code: '71046', label: 'Chest X-ray, 2 views' },
    { code: '70450', label: 'CT head without contrast' },
    { code: '73721', label: 'MRI lower extremity without contrast' },
    { code: '97110', label: 'Therapeutic exercises' },
    { code: 'E0601', label: 'CPAP device' },
];

export const DEFAULT_INSURANCE_PAYER = 'Commercial PPO';
export const DEFAULT_PAYER_NAME = 'BlueCross Health Plan';
