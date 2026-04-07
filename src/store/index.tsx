import { combineReducers, configureStore } from '@reduxjs/toolkit';
import themeConfigSlice from './themeConfigSlice';
import authSlice from './authSlice';
import facesheetSlice from './facesheetSlice';
import adtEncounterReducer, { type AdtEncounterState } from './adtEncounterSlice';

const ADT_ENCOUNTER_STORAGE_KEY = 'emr.adt.encounters.v1';

function loadPersistedAdtEncounters(): Record<string, AdtEncounterState> | undefined {
    if (typeof localStorage === 'undefined') return undefined;
    try {
        const raw = localStorage.getItem(ADT_ENCOUNTER_STORAGE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
        return parsed as Record<string, AdtEncounterState>;
    } catch {
        return undefined;
    }
}

const persistedAdt = loadPersistedAdtEncounters();

const rootReducer = combineReducers({
    themeConfig: themeConfigSlice,
    auth: authSlice,
    facesheet: facesheetSlice,
    adtEncounter: adtEncounterReducer,
});

const store = configureStore({
    reducer: rootReducer,
    preloadedState: persistedAdt
        ? {
              adtEncounter: { byPatientId: persistedAdt },
          }
        : undefined,
});

let lastAdtSnapshot = JSON.stringify(store.getState().adtEncounter.byPatientId);
store.subscribe(() => {
    const next = JSON.stringify(store.getState().adtEncounter.byPatientId);
    if (next === lastAdtSnapshot) return;
    lastAdtSnapshot = next;
    try {
        localStorage.setItem(ADT_ENCOUNTER_STORAGE_KEY, next);
    } catch {
        /* ignore quota */
    }
});

export default store;
export type IRootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
