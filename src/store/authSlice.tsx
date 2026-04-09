import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { PremiumStatus } from '../types/premium';
import api from '../services/api';
import { parseLoginResponse } from '../services/auth.service';
import {
    getStoredRefreshToken,
    isAccessTokenExpired,
    persistAuthPair,
} from '../services/auth-tokens';

const BASE_URL = 'https://devapi.mdcareproviders.com';

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
}

const getInitialToken = (): string | null => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    if (!isAccessTokenExpired(token)) {
        return token;
    }
    if (getStoredRefreshToken()) {
        return token;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('patientData');
    return null;
};

const getInitialPatientData = (): Record<string, any> | null => {
    try {
        const raw = localStorage.getItem('patientData');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
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
    patientData: getInitialPatientData(),
    loading: false,
};

// Configure Axios base URL
axios.defaults.baseURL = BASE_URL;

// Set initial auth header if token exists
if (initialState.token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${initialState.token}`;
}

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

// Async thunks
export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const payload = {
                username: email.trim(),
                password: password.trim(),
            };
            console.log('[login] POST /login payload:', payload);
            const response = await api.post('/login', payload, {
                headers: { 'Content-Type': 'application/json' },
            });
            const parsed = parseLoginResponse(response.data);
            if (!parsed) {
                return rejectWithValue('Invalid login response from server');
            }

            let userPayload: User = parsed.user
                ? ({ ...parsed.user, email: String((parsed.user as User).email ?? email) } as User)
                : ({ email } as User);
            let role: string | null = parsed.role;

            persistAuthPair(parsed.token, parsed.refreshToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;

            if (!role || !userPayload.role) {
                const hydrated = await fetchStaffProfileAfterAuth(email, userPayload);
                userPayload = hydrated.user;
                role = hydrated.role ?? role;
            } else {
                localStorage.setItem('user', JSON.stringify(userPayload));
                if (role) localStorage.setItem('role', role);
            }

            return {
                token: parsed.token,
                user: userPayload,
                role,
                data: response.data,
            };
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
            const response = await axios.post('/auth/register', {
                username,
                email,
                password,
                address,
                industry,
                subdomain,
            });
            const { token, user, role, refreshToken } = response.data as {
                token: string;
                user: User;
                role: string;
                refreshToken?: string;
            };

            persistAuthPair(token, refreshToken ?? null);
            localStorage.setItem('role', role);
            localStorage.setItem('user', JSON.stringify(user));
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

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
        setToken: (state, action: PayloadAction<string | null>) => {
            state.token = action.payload;
            if (action.payload) {
                localStorage.setItem('token', action.payload);
                axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload}`;
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                delete axios.defaults.headers.common['Authorization'];
            }
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
        setPatientData: (state, action: PayloadAction<Record<string, any> | null>) => {
            state.patientData = action.payload;
            if (action.payload) {
                localStorage.setItem('patientData', JSON.stringify(action.payload));
            } else {
                localStorage.removeItem('patientData');
            }
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
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            localStorage.removeItem('user');
            localStorage.removeItem('patientData');
            localStorage.removeItem('premiumSubscription');
            delete axios.defaults.headers.common['Authorization'];
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
        checkTokenExpiration: (state) => {
            if (!state.token) return;
            if (!isAccessTokenExpired(state.token)) return;
            if (getStoredRefreshToken()) {
                return;
            }
            state.token = null;
            state.user = null;
            state.role = null;
            state.cloudSubscriptions = null;
            state.premiumSubscription = null;
            state.patientData = null;
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            localStorage.removeItem('user');
            localStorage.removeItem('patientData');
            localStorage.removeItem('premiumSubscription');
            delete axios.defaults.headers.common['Authorization'];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.role = action.payload.role;
            })
            .addCase(loginUser.rejected, (state) => {
                state.loading = false;
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

