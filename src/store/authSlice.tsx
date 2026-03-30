import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { PremiumStatus } from '../types/premium';
import api from '../services/api';
import { parseLoginResponse } from '../services/auth.service';

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

// Check if token is expired
const isTokenExpired = (token: string): boolean => {
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const currentTime = Date.now() / 1000;
            return payload.exp < currentTime;
        }
        return false;
    } catch (error) {
        return false;
    }
};

const getInitialToken = (): string | null => {
    const token = localStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
        return token;
    }
    if (token && isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        localStorage.removeItem('patientData');
    }
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

            const userPayload: User = parsed.user
                ? ({ ...parsed.user, email: String((parsed.user as User).email ?? email) } as User)
                : ({ email } as User);

            localStorage.setItem('token', parsed.token);
            localStorage.setItem('user', JSON.stringify(userPayload));
            if (parsed.role) localStorage.setItem('role', parsed.role);

            axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;

            return {
                token: parsed.token,
                user: userPayload,
                role: parsed.role,
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
            const { token, user, role } = response.data;

            localStorage.setItem('token', token);
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
            if (state.token) {
                try {
                    const parts = state.token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        const currentTime = Date.now() / 1000;
                        if (payload.exp < currentTime) {
                            // Token expired
                            state.token = null;
                            state.user = null;
                            state.role = null;
                            state.cloudSubscriptions = null;
                            state.premiumSubscription = null;
                            state.patientData = null;
                            localStorage.removeItem('token');
                            localStorage.removeItem('role');
                            localStorage.removeItem('user');
                            localStorage.removeItem('patientData');
                            localStorage.removeItem('premiumSubscription');
                            delete axios.defaults.headers.common['Authorization'];
                        }
                    }
                } catch (error) {
                    // If we can't parse, assume it's valid
                }
            }
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
            });
    },
});

export const { setToken, setUser, setRole, setPatientData, setPremiumSubscription, logout, updateTenantSubscriptionStatus, checkTokenExpiration } = authSlice.actions;
export default authSlice.reducer;

