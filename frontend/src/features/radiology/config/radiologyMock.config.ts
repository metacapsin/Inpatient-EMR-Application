/** When not "false", radiology falls back to in-memory mock data. Set VITE_RADIOLOGY_MOCK=false when the backend is live. */
export const USE_RADIOLOGY_MOCK = import.meta.env.VITE_RADIOLOGY_MOCK !== 'false';

/** Max wait for real API before falling back to in-memory mock data. */
export const RADIOLOGY_API_TIMEOUT_MS = 5_000;
