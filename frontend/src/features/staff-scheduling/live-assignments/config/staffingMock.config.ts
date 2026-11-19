/** Opt-in in-memory mock (VITE_STAFFING_API_MOCK=true). Default: real backend. */
export const USE_STAFFING_MOCK = import.meta.env.VITE_STAFFING_API_MOCK === 'true';

export const STAFFING_API_TIMEOUT_MS = 4000;

export const SHIFT_API_OPTIONS = [
    { value: 'day', label: 'Day (7a–7p)' },
    { value: 'evening', label: 'Evening (3p–11p)' },
    { value: 'night', label: 'Night (7p–7a)' },
] as const;

export type StaffingShiftToken = (typeof SHIFT_API_OPTIONS)[number]['value'];
