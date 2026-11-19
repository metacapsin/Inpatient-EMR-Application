/** Opt-in in-memory mock (VITE_CARE_PLAN_MOCK=true). Default: real backend, no silent fallback. */
export const USE_CARE_PLAN_MOCK = import.meta.env.VITE_CARE_PLAN_MOCK === 'true';

export const CARE_PLAN_API_TIMEOUT_MS = 4500;
