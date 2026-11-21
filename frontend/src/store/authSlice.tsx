import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { PremiumStatus } from '../types/premium';
import api from '../services/api';
import { parseLoginResponse } from '../services/auth.service';
import {
    clearStoredTokens,
    isAccessTokenExpired,
    persistAuthPair,
    refreshAccessToken,
} from '../services/auth-tokens';

// Define types
export interface User {
    id?: string;
    username?: string;
    email: string;
    role?: string;
    tenant?: {
        id?: string;
        subscription_status?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface CloudSubscriptions {
    azure: boolean;
    aws: boolean;
    gcp: boolean;
}

interface AuthState {
    token: string | null;
    user: User | null;
    role: string | null;
    cloudSubscriptions: CloudSubscriptions | null;
    premiumSubscription: PremiumStatus | null;
    patientData: Record<string, any> | null;
    loading: boolean;
    /** Set when /login answers `mfa_required` — the user must submit a TOTP/backup code to finish. */
    mfaChallenge: { mfaToken: string } | null;
    /** True once the first bootstrapAuth() attempt (success or failure) has resolved. ProtectedRoute
     *  waits for this instead of redirecting to /login on the render before it's had a chance to run
     *  — otherwise a genuinely still-logged-in user would flash through the login page on every
     *  reload, since the access token itself is never persisted across reloads (SEC-09). */
    bootstrapped: boolean;
}

// SEC-09: the access token is in-memory only now (see auth-tokens.ts), so there is nothing to read
// back out of localStorage on a fresh page load — any old 'token' value left over from before this
// change is stale and cleared. bootstrapAuth() (below) re-derives a session from the httpOnly
// refresh cookie instead.
const getInitialToken = (): string | null => {
    const stale = localStorage.getItem('token');
    if (stale) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
    }
    return null;
};

const getInitialPremiumStatus = (): PremiumStatus | null => {
    try {
        const raw = localStorage.getItem('premiumSubscription');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const initialState: AuthState = {
    token: getInitialToken(),
    user: (() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    })(),
    role: localStorage.getItem('role'),
    cloudSubscriptions: null,
    premiumSubscription: getInitialPremiumStatus(),
    // SEC-09: no longer cached in localStorage — repopulated from the server after bootstrap/login.
    patientData: null,
    loading: false,
    mfaChallenge: null,
    bootstrapped: false,
};

/** EMR-Backend login only returns tokens; staff profile (incl. role) comes from GET /Users/getUserProfile. */
function roleFromProfilePayload(raw: unknown): string | null {
    if (raw == null) return null;
    if (Array.isArray(raw)) {
        const parts = raw.filter(Boolean).map(String);
        return parts.length ? parts.join(',') : null;
    }
    const s = String(raw).trim();
    return s || null;
}

async function fetchStaffProfileAfterAuth(email: string, baseUser: User): Promise<{ user: User; role: string | null }> {
    try {
        const response = await api.get<{ data?: Record<string, unknown> }>('/Users/getUserProfile');
        const p = response.data?.data;
        if (!p || typeof p !== 'object') {
            return { user: baseUser, role: null };
        }
        const role = roleFromProfilePayload(p.role) ?? null;
        const userPayload: User = {
            ...baseUser,
            ...p,
            email: String(p.email ?? baseUser.email ?? email),
            role: role ?? (baseUser.role as string | undefined),
        };
        if (p._id != null) {
            userPayload.id = String(p._id);
        }
        localStorage.setItem('user', JSON.stringify(userPayload));
        if (role) {
            localStorage.setItem('role', role);
        }
        return { user: userPayload, role };
    } catch {
        localStorage.setItem('user', JSON.stringify(baseUser));
        return { user: baseUser, role: null };
    }
}

/** Load staff role + user fields when we have an access token but login did not return them. */
export const hydrateStaffSession = createAsyncThunk(
    'auth/hydrateStaff',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get<{ data?: Record<string, unknown> }>('/Users/getUserProfile');
            const p = response.data?.data;
            if (!p || typeof p !== 'object') {
                return rejectWithValue('No profile');
            }
            const role = roleFromProfilePayload(p.role);
            const email = String(p.email ?? '');
            const userPayload: User = {
                ...p,
                email,
                role: role ?? undefined,
            } as User;
            if (p._id != null) {
                userPayload.id = String(p._id);
            }
            return { user: userPayload, role };
        } catch (error: unknown) {
            const message =
                error &&
                typeof error === 'object' &&
                'response' in error &&
                (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            return rejectWithValue(typeof message === 'string' ? message : 'Profile fetch failed');
        }
    }
);

async function finishLoginResponse(email: string, data: unknown) {
    const parsed = parseLoginResponse(data);
    if (!parsed) return null;

    let userPayload: User = parsed.user
        ? ({ ...parsed.user, email: String((parsed.user as User).email ?? email) } as User)
        : ({ email } as User);
    let role: string | null = parsed.role;

    persistAuthPair(parsed.token);

    if (!role || !userPayload.role) {
        const hydrated = await fetchStaffProfileAfterAuth(email, userPayload);
        userPayload = hydrated.user;
        role = hydrated.role ?? role;
    } else {
        localStorage.setItem('user', JSON.stringify(userPayload));
        if (role) localStorage.setItem('role', role);
    }

    return { mfaRequired: false as const, token: parsed.token, user: userPayload, role, data };
}

// Async thunks
export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const payload = {
                username: email.trim(),
                password: password.trim(),
            };
            const response = await api.post('/login', payload, {
                headers: { 'Content-Type': 'application/json' },
            });
            const body = response.data as { status?: string; mfaToken?: string };
            if (body?.status === 'mfa_required' && body.mfaToken) {
                return { mfaRequired: true as const, mfaToken: body.mfaToken };
            }

            const result = await finishLoginResponse(email, response.data);
            if (!result) return rejectWithValue('Invalid login response from server');
            return result;
        } catch (error: any) {
            const message =
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Login failed';
            return rejectWithValue(typeof message === 'string' ? message : 'Login failed');
        }
    }
);

/** Second step after /login answers mfa_required — submits a TOTP code or a backup code. */
export const verifyMfaCode = createAsyncThunk(
    'auth/verifyMfaCode',
    async (
        { email, mfaToken, code, backupCode }: { email: string; mfaToken: string; code?: string; backupCode?: string },
        { rejectWithValue },
    ) => {
        try {
            const response = await api.post('/auth/mfa/verify', { mfaToken, code, backupCode });
            const result = await finishLoginResponse(email, response.data);
            if (!result) return rejectWithValue('Invalid login response from server');
            return result;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Invalid code';
            return rejectWithValue(typeof message === 'string' ? message : 'Invalid code');
        }
    },
);

/** Silently restores a session from the httpOnly refresh cookie on app load (SEC-09 — the access
 *  token itself is never persisted, so a fresh page load has none until this succeeds). */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_, { getState, rejectWithValue }) => {
    const token = await refreshAccessToken();
    if (!token) return rejectWithValue('No session');
    // Keep the cached staff user as the base so the header does not flash "User" while profile loads.
    const existing = (getState() as { auth: AuthState }).auth.user;
    const baseUser: User = existing?.email
        ? existing
        : ({ email: existing?.email || '', ...(existing || {}) } as User);
    const hydrated = await fetchStaffProfileAfterAuth(baseUser.email || '', baseUser);
    return { token, user: hydrated.user, role: hydrated.role ?? (getState() as { auth: AuthState }).auth.role };
});

/** User-initiated sign-out: revokes the refresh-token cookie server-side (POST /auth/logout) before
 *  clearing client state. The `logout()` reducer alone only ever forgot the session locally — the
 *  server-side token stayed valid until its own 7-day expiry, which was itself part of SEC-07. */
export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { dispatch }) => {
    try {
        await api.post('/auth/logout');
    } catch {
        // Best-effort — still clear the local session even if the network call fails.
    }
    dispatch(logout());
});

export const registerUser = createAsyncThunk(
    'auth/register',
    async (
        { username, email, password, address, industry, subdomain }: {
            username: string;
            email: string;
            password: string;
            address?: string;
            industry?: string;
            subdomain?: string;
        },
        { rejectWithValue }
    ) => {
        try {
            // Previously a bare `axios.post`, which only worked because of the now-removed
            // axios.defaults.baseURL hardcoded to a third-party domain (SEC-19) — `api` is
            // correctly configured against this app's own backend and carries the interceptors.
            const response = await api.post('/auth/register', {
                username,
                email,
                password,
                address,
                industry,
                subdomain,
            });
            const { token, user, role } = response.data as {
                token: string;
                user: User;
                role: string;
            };

            persistAuthPair(token);
            localStorage.setItem('role', role);
            localStorage.setItem('user', JSON.stringify(user));

            return { token, user, role };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Registration failed');
        }
    }
);

export const fetchCloudSubscriptions = createAsyncThunk(
    'auth/fetchCloudSubscriptions',
    async (_, { rejectWithValue }) => {
        try {
            // const response = await axios.get('/cloud-credentials/user-subscriptions');
            // if (response.data.success) {
            //   return response.data.data.cloudSubscriptions;
            // }
            // Return default if API is not available
            return { azure: false, aws: false, gcp: false };
        } catch (error: any) {
            console.error('Failed to fetch cloud subscriptions:', error);
            return { azure: false, aws: false, gcp: false };
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        // Pure Redux state now — auth-tokens.ts owns the actual token storage (in-memory, SEC-09)
        // and the `api` interceptor reads it fresh on every request, so there's nothing else to do
        // here. This is also what registerAccessTokenSync (main.tsx) dispatches after a background
        // silent refresh, to keep this state in sync with the token auth-tokens.ts just rotated.
        setToken: (state, action: PayloadAction<string | null>) => {
            state.token = action.payload;
            if (!action.payload) clearStoredTokens();
        },
        setUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload;
            if (action.payload) {
                localStorage.setItem('user', JSON.stringify(action.payload));
            } else {
                localStorage.removeItem('user');
            }
        },
        setRole: (state, action: PayloadAction<string | null>) => {
            state.role = action.payload;
            if (action.payload) {
                localStorage.setItem('role', action.payload);
            } else {
                localStorage.removeItem('role');
            }
        },
        // SEC-09: no longer mirrored to localStorage — this is Redux-only state, refetched from the
        // server as needed rather than cached across reloads.
        setPatientData: (state, action: PayloadAction<Record<string, any> | null>) => {
            state.patientData = action.payload;
        },
        setPremiumSubscription: (state, action: PayloadAction<PremiumStatus | null>) => {
            state.premiumSubscription = action.payload;
            if (action.payload) {
                localStorage.setItem('premiumSubscription', JSON.stringify(action.payload));
            } else {
                localStorage.removeItem('premiumSubscription');
            }
        },
        logout: (state) => {
            state.token = null;
            state.user = null;
            state.role = null;
            state.cloudSubscriptions = null;
            state.premiumSubscription = null;
            state.patientData = null;
            state.mfaChallenge = null;
            clearStoredTokens();
            // 'token'/'refreshToken'/'patientData' are no longer written anywhere (SEC-09), but a
            // browser that still has them from before this change gets cleaned up here regardless.
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            localStorage.removeItem('user');
            localStorage.removeItem('patientData');
            localStorage.removeItem('premiumSubscription');
        },
        updateTenantSubscriptionStatus: (state, action: PayloadAction<string>) => {
            if (state.user) {
                state.user = {
                    ...state.user,
                    tenant: {
                        ...state.user.tenant,
                        subscription_status: action.payload,
                    },
                };
                localStorage.setItem('user', JSON.stringify(state.user));
            }
        },
        // There's no stored refresh token to check for anymore (httpOnly) before deciding whether to
        // clear state — the `api` interceptor already attempts a silent refresh proactively before
        // every request, so by the time this ever sees an expired token, a refresh has already been
        // tried and failed. Simply clearing state here is correct, not a behavior regression.
        checkTokenExpiration: (state) => {
            if (!state.token) return;
            if (!isAccessTokenExpired(state.token)) return;
            state.token = null;
            state.user = null;
            state.role = null;
            state.cloudSubscriptions = null;
            state.premiumSubscription = null;
            state.patientData = null;
            clearStoredTokens();
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            localStorage.removeItem('user');
            localStorage.removeItem('patientData');
            localStorage.removeItem('premiumSubscription');
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                if (action.payload.mfaRequired) {
                    state.mfaChallenge = { mfaToken: action.payload.mfaToken };
                    return;
                }
                state.mfaChallenge = null;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.role = action.payload.role;
            })
            .addCase(loginUser.rejected, (state) => {
                state.loading = false;
            })
            .addCase(verifyMfaCode.pending, (state) => {
                state.loading = true;
            })
            .addCase(verifyMfaCode.fulfilled, (state, action) => {
                state.loading = false;
                state.mfaChallenge = null;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.role = action.payload.role;
            })
            .addCase(verifyMfaCode.rejected, (state) => {
                state.loading = false;
            })
            .addCase(bootstrapAuth.fulfilled, (state, action) => {
                state.bootstrapped = true;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.role = action.payload.role;
            })
            .addCase(bootstrapAuth.rejected, (state) => {
                state.bootstrapped = true;
                state.token = null;
                state.user = null;
                state.role = null;
                state.patientData = null;
                clearStoredTokens();
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('role');
                localStorage.removeItem('user');
                localStorage.removeItem('patientData');
            })
            .addCase(registerUser.pending, (state) => {
                state.loading = true;
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.loading = false;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.role = action.payload.role;
            })
            .addCase(registerUser.rejected, (state) => {
                state.loading = false;
            })
            .addCase(fetchCloudSubscriptions.fulfilled, (state, action) => {
                state.cloudSubscriptions = action.payload;
            })
            .addCase(hydrateStaffSession.fulfilled, (state, action) => {
                state.user = action.payload.user;
                state.role = action.payload.role;
                localStorage.setItem('user', JSON.stringify(action.payload.user));
                if (action.payload.role) {
                    localStorage.setItem('role', action.payload.role);
                }
            });
    },
});

export const { setToken, setUser, setRole, setPatientData, setPremiumSubscription, logout, updateTenantSubscriptionStatus, checkTokenExpiration } = authSlice.actions;
export default authSlice.reducer;

