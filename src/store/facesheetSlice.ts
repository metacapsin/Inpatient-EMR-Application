import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getPatientById, type FacesheetPatient } from '../services/patient.service';
import { logout } from './authSlice';

export const fetchFacesheetPatient = createAsyncThunk(
    'facesheet/fetchPatient',
    async (id: string, { rejectWithValue }) => {
        try {
            return await getPatientById(id);
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'response' in e
                    ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
                    : '';
            const fallback = e instanceof Error ? e.message : 'Failed to load patient';
            return rejectWithValue(msg || fallback);
        }
    }
);

interface FacesheetState {
    activePatientId: string | null;
    patient: FacesheetPatient | null;
    loading: boolean;
    error: string | null;
}

const initialState: FacesheetState = {
    activePatientId: null,
    patient: null,
    loading: false,
    error: null,
};

const facesheetSlice = createSlice({
    name: 'facesheet',
    initialState,
    reducers: {
        clearFacesheet: () => initialState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchFacesheetPatient.pending, (state, action) => {
                state.loading = true;
                state.error = null;
                const nextId = action.meta.arg;
                if (state.activePatientId !== nextId) {
                    state.patient = null;
                }
            })
            .addCase(fetchFacesheetPatient.fulfilled, (state, action) => {
                state.loading = false;
                state.activePatientId = action.meta.arg;
                state.patient = action.payload;
                state.error = null;
            })
            .addCase(fetchFacesheetPatient.rejected, (state, action) => {
                state.loading = false;
                state.patient = null;
                state.error = typeof action.payload === 'string' ? action.payload : 'Failed to load patient';
            })
            .addCase(logout, () => initialState);
    },
});

export const { clearFacesheet } = facesheetSlice.actions;
export default facesheetSlice.reducer;
