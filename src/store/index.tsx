import { combineReducers, configureStore } from '@reduxjs/toolkit';
import themeConfigSlice from './themeConfigSlice';
import authSlice from './authSlice';
import facesheetSlice from './facesheetSlice';
import adtEncounterReducer from './adtEncounterSlice';

const rootReducer = combineReducers({
    themeConfig: themeConfigSlice,
    auth: authSlice,
    facesheet: facesheetSlice,
    adtEncounter: adtEncounterReducer,
});

/** ADT workspace is session-only; active encounters come from GET /api/admissions/active (server source of truth). */
const store = configureStore({
    reducer: rootReducer,
});

export default store;
export type IRootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
