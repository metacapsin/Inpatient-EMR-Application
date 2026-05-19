import type {
    CodeEventOutcome,
    CodeEventType,
    CodePostEventDisposition,
    CodeTeamRole,
    CodeTimelineEntryType,
} from '../../../types/codeEvent';

export const CODE_EVENT_TYPES: CodeEventType[] = [
    'Code Blue',
    'Rapid Response',
    'Code Stroke',
    'Code STEMI',
    'Code Sepsis',
    'Code OB',
];

export const CODE_TIMELINE_ENTRY_TYPES: CodeTimelineEntryType[] = [
    'Rhythm Check',
    'CPR Started',
    'CPR Stopped',
    'Defibrillation',
    'Cardioversion',
    'Medication Given',
    'Airway Established',
    'IV Access',
    'IO Access',
    'Lab Drawn',
    'Imaging',
    'ROSC',
    'Patient Expired',
    'Family Notified',
    'Other',
];

export const CODE_TEAM_ROLES: CodeTeamRole[] = ['MD', 'RN', 'RT', 'Pharmacist', 'Charge Nurse', 'Other'];

export const CODE_EVENT_OUTCOMES: CodeEventOutcome[] = [
    'ROSC',
    'Patient Expired',
    'Transferred to ICU',
    'Transferred to Cath Lab',
    'Stable — Continued Same Unit',
    'Transported to OR',
];

export const CODE_EVENT_DISPOSITIONS: CodePostEventDisposition[] = [
    'ICU',
    'Step-Down',
    'Cath Lab',
    'OR',
    'Same Unit',
    'Morgue',
];

export const MEDICATION_TIMELINE_TYPES: CodeTimelineEntryType[] = ['Medication Given'];
export const JOULES_TIMELINE_TYPES: CodeTimelineEntryType[] = ['Defibrillation', 'Cardioversion'];
export const CPR_START_TYPE: CodeTimelineEntryType = 'CPR Started';
export const CPR_STOP_TYPE: CodeTimelineEntryType = 'CPR Stopped';

/** Called-at may be edited within ±5 minutes of activation */
export const CALLED_AT_EDIT_WINDOW_MS = 5 * 60 * 1000;
