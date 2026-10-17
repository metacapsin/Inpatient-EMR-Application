/** Set to `false` when IORecord backend routes are live — no component changes required. */
export const USE_IO_MOCK = import.meta.env.VITE_IO_MOCK !== 'false';

/** Max wait for real API before falling back to in-memory mock data. */
export const IO_API_TIMEOUT_MS = 5_000;
