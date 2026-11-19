/** Opt-in in-memory mock (VITE_RADIOLOGY_MOCK=true). Default: real backend, no silent fallback. */
export const USE_RADIOLOGY_MOCK = import.meta.env.VITE_RADIOLOGY_MOCK === 'true';

/** Max wait for real API before falling back to in-memory mock data. */
export const RADIOLOGY_API_TIMEOUT_MS = 5_000;
