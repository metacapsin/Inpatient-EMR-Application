/** Opt-in in-memory mock (VITE_IO_MOCK=true). Default: real backend, no silent fallback. */
export const USE_IO_MOCK = import.meta.env.VITE_IO_MOCK === 'true';

/** Max wait for real API before falling back to in-memory mock data. */
export const IO_API_TIMEOUT_MS = 5_000;
