/** When not "false", code events fall back to in-memory mock data. Set VITE_CODE_EVENT_MOCK=false when the backend is live. */
export const USE_CODE_EVENT_MOCK = import.meta.env.VITE_CODE_EVENT_MOCK !== 'false';

/** Max wait for real API before falling back to in-memory mock data. */
export const CODE_EVENT_API_TIMEOUT_MS = 5_000;

/** Default inpatient unit for dashboard active-event polling */
export const DEFAULT_CODE_EVENT_UNIT_ID = 'unit-1';
