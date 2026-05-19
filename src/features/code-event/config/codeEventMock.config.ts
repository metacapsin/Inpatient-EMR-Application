/** Set to `false` when Code Event backend routes are live — UI stays unchanged. */
export const USE_CODE_EVENT_MOCK = true;

/** Max wait for real API before falling back to in-memory mock data. */
export const CODE_EVENT_API_TIMEOUT_MS = 5_000;

/** Default inpatient unit for dashboard active-event polling */
export const DEFAULT_CODE_EVENT_UNIT_ID = 'unit-1';
