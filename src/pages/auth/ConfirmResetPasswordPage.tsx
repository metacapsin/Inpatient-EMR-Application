import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import IconLockDots from '../../components/Icon/IconLockDots';

const ConfirmResetPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/;

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewPassword(val);
        if (val && !passwordRegex.test(val)) {
            setPasswordError('Min 10 characters with uppercase, lowercase, number & special character.');
        } else {
            setPasswordError('');
        }
    };

    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black">
                <div className="text-center p-8">
                    <p className="text-red-500 font-semibold mb-4">Invalid or missing reset token.</p>
                    <Link to="/" className="text-primary hover:underline text-sm font-semibold">
                        ← Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword) {
            toast.error('Please enter your new password');
            return;
        }
        if (!passwordRegex.test(newPassword)) {
            toast.error('Password must be at least 10 characters long and include uppercase, lowercase, a number, and a special character.');
            return;
        }

        setIsSubmitting(true);
        toast.success('Password reset successfully!', { id: 'confirm-reset' });
        setTimeout(() => navigate('/'), 2000);
        setIsSubmitting(false);
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Side */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-black dark:text-white mb-4">Set New Password</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Choose a strong password to secure your account.
                    </p>
                </div>
            </div>

            {/* Right Side */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-white dark:bg-black">
                <div className="w-full max-w-lg bg-white dark:bg-[#141210] rounded-xl shadow-primary/10 shadow-lg border border-primary-100/50 dark:border-primary-900/30 p-6 lg:p-10">
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <IconLockDots className="w-8 h-8 text-primary" />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-black dark:text-white">Reset Password</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                            Enter and confirm your new password below.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="newPassword" className="block mb-2 font-semibold text-black dark:text-white">
                                Change your Password <span className="text-primary-600">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="newPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={handlePasswordChange}
                                    className="form-input w-full pr-10"
                                    placeholder="Enter new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <FaEyeSlash className="text-lg" /> : <FaEye className="text-lg" />}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="text-red-500 text-xs mt-1">{passwordError}</p>
                            )}
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
                                    Resetting...
                                </span>
                            ) : (
                                'Reset Password'
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

export default ConfirmResetPasswordPage;
