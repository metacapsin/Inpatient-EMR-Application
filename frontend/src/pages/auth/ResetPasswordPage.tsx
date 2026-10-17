import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import IconMail from '../../components/Icon/IconMail';
import { patientAPI } from '../../services/api';

const ResetPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error('Please enter your email address');
            return;
        }
        setIsSubmitting(true);
        toast.loading('Sending reset link...', { id: 'reset' });

        try {
            const response = await patientAPI.forgotPassword(email);
            const { status, message } = response.data;
            if (status === 'success') {
                toast.success(message || 'Reset link sent! Check your email.', { id: 'reset' });
                setTimeout(() => navigate('/'), 2000);
            } else {
                toast.error(message || 'Failed to send reset link.', { id: 'reset' });
            }
        } catch (error: any) {
            const serverMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to send reset link.';
            toast.error(serverMessage, { id: 'reset' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Side */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-black dark:text-white mb-4">Forgot Password?</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        No worries — we'll send you reset instructions.
                    </p>
                </div>
            </div>

            {/* Right Side */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-white dark:bg-black">
                <div className="w-full max-w-lg bg-white dark:bg-[#141210] rounded-xl shadow-primary/10 shadow-lg border border-primary-100/50 dark:border-primary-900/30 p-6 lg:p-10">
                    {/* Icon */}
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <IconMail className="w-8 h-8 text-primary" />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-black dark:text-white">Reset Password</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                            Enter your registered email and we'll send you a link to reset your password.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block mb-2 font-semibold text-black dark:text-white">
                                    Email Address <span className="text-primary-600">*</span>
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="form-input"
                                    placeholder="Enter your registered email"
                                />
                            </div>

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
                                        Sending...
                                    </span>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>
                        </form>

                    <div className="text-center pt-6">
                        <Link to="/" className="text-primary hover:underline text-sm font-semibold">
                            ← Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
