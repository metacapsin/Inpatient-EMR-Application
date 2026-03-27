import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setToken, setUser, setRole, setPatientData } from '../../store/authSlice';
import { IRootState } from '../../store';
import { toast } from 'sonner';
// CSRF disabled because JWT-based authentication is used
// import { patientAPI, securityAPI } from '../../services/api';
import { patientAPI } from '../../services/api';
import IconEye from '../../components/Icon/IconEye';

const AuthPage: React.FC = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        rememberMe: false,
    });
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const token = useSelector((state: IRootState) => state.auth.token);
    // const premiumSubscription = useSelector((state: IRootState) => state.auth.premiumSubscription);

    // Redirect only when a valid (non-expired) token exists (do not auto-login; user must log in manually)
    const isTokenValid = (t: string | null): boolean => {
        if (!t) return false;
        try {
            const parts = t.split('.');
            if (parts.length !== 3) return false;
            const payload = JSON.parse(atob(parts[1]));
            return payload.exp && payload.exp > Date.now() / 1000;
        } catch {
            return false;
        }
    };

    useEffect(() => {
        if (isTokenValid(token)) {
            // navigate(premiumSubscription?.active ? '/app/dashboard' : '/app/subscription');
            navigate('/app/dashboard');
        }
    }, [token, navigate]); // was: [token, premiumSubscription?.active, navigate]

    const handleChange = (field: string, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username || !formData.password) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        toast.loading('Logging in...', { id: 'login' });

        try {
            const response = await patientAPI.patientUserlogin({
                username: formData.username,
                password: formData.password,
            });

            const { data } = response;

            // ✅ Handle API-level error (HTTP 200 but status: "error")
            if (data.status === 'error' || !data.token) {
                throw new Error(data.message || 'Login failed. Please check your credentials.');
            }

            // Extract user & role from response
            const userData = data.user || data.data?.user;
            const roleData = data.role || userData?.role || null;
            const patientEmail =
                data.patientEmail ?? userData?.patientEmail ?? userData?.email ?? userData?.emailAddress;

            // Update Redux store (reducers handle localStorage automatically)
            dispatch(setToken(data.token));
            if (userData) dispatch(setUser(userData));
            if (roleData) dispatch(setRole(roleData));

            // Store extras that Redux doesn't manage
            localStorage.setItem('patientLoginResponse', JSON.stringify(data));
            if (patientEmail) localStorage.setItem('patientEmail', patientEmail);

            // Fetch full patient data using patientId from login response
            const patientId = userData?.patientId || userData?.id;
            if (patientId) {
                try {
                    const patientRes = await patientAPI.getPatientByID(
                        String(patientId).trim(),
                        data.token
                    );
                    if (patientRes.data) {
                        dispatch(setPatientData(patientRes.data));
                    }
                } catch (patientErr: any) {
                    console.warn('Failed to fetch patient data after login:', patientErr?.response?.data || patientErr);
                }
            }

            // CSRF disabled because JWT-based authentication is used
            // try {
            //     const csrfResponse = await securityAPI.getCsrfToken();
            //     const csrfToken = csrfResponse.data?.data?.csrfToken;
            //     if (csrfToken) {
            //         localStorage.setItem('csrfToken', csrfToken);
            //         document.cookie = `_csrf=${encodeURIComponent(csrfToken)}; path=/`;
            //     }
            // } catch (csrfError) {
            //     console.warn('Failed to fetch CSRF token:', csrfError);
            // }

            // toast.success('Login successful! Choose a plan to get started.', { id: 'login' });
            toast.success('Login successful!', { id: 'login' });

            setTimeout(() => {
                setIsSubmitting(false);
                // navigate(premiumSubscription?.active ? '/app/dashboard' : '/app/subscription');
                navigate('/app/dashboard');
            }, 1500);
        } catch (error: any) {
            setIsSubmitting(false);
            const errorMessage =
                error.response?.data?.message ||
                error.message ||
                'Login failed. Please check your credentials and try again.';
            toast.error(errorMessage, { id: 'login', duration: 5000 });
            console.error('Login error:', error);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Side - Illustration Section (can be added later) */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-black dark:text-white mb-4">Welcome Back</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">Sign in to access your patient portal</p>
                </div>
            </div>

            {/* Right Side - Login Form Section */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-white dark:bg-black">
                <div className="w-full max-w-lg bg-white dark:bg-[#141210] rounded-xl shadow-primary/10 shadow-lg border border-primary-100/50 dark:border-primary-900/30 p-6 lg:p-10">
                    {/* Logo/Title */}
                    <div className="flex items-center justify-center mb-8">
                        <h2 className="text-2xl font-bold text-black dark:text-white">EMR Inpatient</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username Field */}
                        <div>
                            <label htmlFor="username" className="block mb-2 font-semibold text-black dark:text-white">
                                Username <span className="text-primary-600">*</span>
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={formData.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                className="form-input"
                                placeholder="Enter your username"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block mb-2 font-semibold text-black dark:text-white">
                                Password <span className="text-primary-600">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    className="form-input pr-10"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                >
                                    <IconEye className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Remember Me and Forgot Password */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.rememberMe}
                                    onChange={(e) => handleChange('rememberMe', e.target.checked)}
                                    className="form-checkbox"
                                />
                                <span className="ltr:ml-2 rtl:mr-2 text-black dark:text-white">Remember me</span>
                            </label>
                            <Link to="/forgot-password" className="text-primary hover:underline text-sm">
                                Forgot Password?
                            </Link>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn btn-primary w-full"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Logging in...
                                </span>
                            ) : (
                                'Login'
                            )}
                        </button>

                        <div className="text-center pt-4">
                            <p className="text-gray-600 dark:text-gray-400">
                                Don't have an account?{' '}
                                <Link to="/signup" className="text-primary hover:underline font-semibold">
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;

