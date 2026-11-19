/** Opt-in in-memory mock (VITE_CODE_EVENT_MOCK=true). Default: real backend, no silent fallback. */
export const USE_CODE_EVENT_MOCK = import.meta.env.VITE_CODE_EVENT_MOCK === 'true';

/** Max wait for real API before falling back to in-memory mock data. */
export const CODE_EVENT_API_TIMEOUT_MS = 5_000;

// SAF-26: was the magic placeholder 'unit-1', special-cased server-side to mean "every unit" —
// now just the real 'all' sentinel the backend already supports on its own.
/** Default inpatient unit for dashboard active-event polling — 'all' units. */
export const DEFAULT_CODE_EVENT_UNIT_ID = 'all';
