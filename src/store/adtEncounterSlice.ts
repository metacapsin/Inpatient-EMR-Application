import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';

/** Global ADT workspace state per patient (replaces tab-scoped sessionStorage). */
export interface AdtEncounterState {
    encounterId: string;
    dischargeInitiated: boolean;
    /** Mongo bed id from last successful admit/transfer; used for same-bed validation. */
    currentBedMongoId: string | null;
    /** After a successful transfer in this workspace, UI shows "Transferred" until discharge. */
    lastPlacementAction?: 'admit' | 'transfer';
}

export interface AdtEncounterSliceState {
    byPatientId: Record<string, AdtEncounterState>;
}

const initialState: AdtEncounterSliceState = {
    byPatientId: {},
};

function normPid(patientId: string): string {
    return patientId.trim();
}

const adtEncounterSlice = createSlice({
    name: 'adtEncounter',
    initialState,
    reducers: {
        setAdtEncounter: (
            state,
            action: PayloadAction<{ patientId: string; encounter: AdtEncounterState }>
        ) => {
            const id = normPid(action.payload.patientId);
            if (!id) return;
            state.byPatientId[id] = action.payload.encounter;
        },
        setAdtAfterAdmit: (
            state,
            action: PayloadAction<{ patientId: string; encounterId: string; bedMongoId: string }>
        ) => {
            const id = normPid(action.payload.patientId);
            if (!id || !action.payload.encounterId.trim()) return;
            state.byPatientId[id] = {
                encounterId: action.payload.encounterId.trim(),
                dischargeInitiated: false,
                currentBedMongoId: action.payload.bedMongoId.trim() || null,
                lastPlacementAction: 'admit',
            };
        },
        setAdtDischargeInitiated: (
            state,
            action: PayloadAction<{ patientId: string; encounterId: string }>
        ) => {
            const id = normPid(action.payload.patientId);
            if (!id) return;
            const cur = state.byPatientId[id];
            if (!cur || cur.encounterId !== action.payload.encounterId.trim()) return;
            state.byPatientId[id] = { ...cur, dischargeInitiated: true };
        },
        setAdtCurrentBed: (
            state,
            action: PayloadAction<{ patientId: string; bedMongoId: string; fromTransfer?: boolean }>
        ) => {
            const id = normPid(action.payload.patientId);
            if (!id) return;
            const cur = state.byPatientId[id];
            if (!cur) return;
            const next: AdtEncounterState = {
                ...cur,
                currentBedMongoId: action.payload.bedMongoId.trim() || null,
            };
            if (action.payload.fromTransfer) {
                next.lastPlacementAction = 'transfer';
            }
            state.byPatientId[id] = next;
        },
        clearAdtEncounter: (state, action: PayloadAction<{ patientId: string }>) => {
            const id = normPid(action.payload.patientId);
            if (!id) return;
            delete state.byPatientId[id];
        },
        hydrateAdtEncounters: (state, action: PayloadAction<Record<string, AdtEncounterState>>) => {
            const incoming = action.payload;
            for (const [k, v] of Object.entries(incoming)) {
                const id = normPid(k);
                if (!id || !v.encounterId?.trim()) continue;
                const placement =
                    v.lastPlacementAction === 'transfer' || v.lastPlacementAction === 'admit'
                        ? v.lastPlacementAction
                        : undefined;
                state.byPatientId[id] = {
                    encounterId: v.encounterId.trim(),
                    dischargeInitiated: Boolean(v.dischargeInitiated),
                    currentBedMongoId: v.currentBedMongoId?.trim() ? v.currentBedMongoId.trim() : null,
                    ...(placement ? { lastPlacementAction: placement } : {}),
                };
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(logout, () => initialState);
    },
});

export const {
    setAdtEncounter,
    setAdtAfterAdmit,
    setAdtDischargeInitiated,
    setAdtCurrentBed,
    clearAdtEncounter,
    hydrateAdtEncounters,
} = adtEncounterSlice.actions;

export function selectAdtEncounter(
    state: { adtEncounter: AdtEncounterSliceState },
    patientId: string | null | undefined
): AdtEncounterState | null {
    const id = patientId?.trim();
    if (!id) return null;
    return state.adtEncounter.byPatientId[id] ?? null;
}

export default adtEncounterSlice.reducer;
