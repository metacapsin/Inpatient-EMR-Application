import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'sonner';
import { IRootState } from '../store';
import { setPatientData } from '../store/authSlice';
import { patientAPI } from '../services/api';
import IconEye from '../components/Icon/IconEye';
import IconEyeOff from '../components/Icon/IconEyeOff';

const Settings: React.FC = () => {
    const dispatch = useDispatch();
    const patientData = useSelector((state: IRootState) => state.auth.patientData);
    const user = useSelector((state: IRootState) => state.auth.user);
    const token = useSelector((state: IRootState) => state.auth.token);

    const patient = patientData?.data ?? patientData;
    const patientId = patient?._id ?? user?.patientId ?? (user as any)?.patientId;

    const [profileFile, setProfileFile] = useState<File | null>(null);
    const [profilePreview, setProfilePreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const profilePhoto =
        profilePreview ??
        patient?.profilePictureUrl ??
        patient?.profilePhoto ??
        patient?.photo ??
        null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file (e.g. JPG, PNG)');
                return;
            }
            setProfileFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setProfilePreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setProfileFile(null);
            setProfilePreview(null);
        }
    };

    const handleUploadPicture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId) {
            toast.error('Patient information not found. Please log in again.');
            return;
        }
        if (!profileFile) {
            toast.error('Please select an image to upload.');
            return;
        }
        setUploading(true);
        const previewUrl = profilePreview;
        try {
            const formData = new FormData();
            formData.append('profilePicture', profileFile, profileFile.name || 'image');
            const updateRes = await patientAPI.updateProfilePicture(patientId, formData);
            if (updateRes.status === 200) {
                const currentData = patientData || { data: {} };
                const currentPatient = currentData?.data ?? currentData;
                const optimisticData = {
                    ...currentData,
                    data: {
                        ...(typeof currentPatient === 'object' && currentPatient !== null ? currentPatient : {}),
                        profilePictureUrl: previewUrl,
                    },
                };
                dispatch(setPatientData(optimisticData));
            }
            toast.success('Profile picture updated successfully.');
            setProfileFile(null);
            setProfilePreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (updateRes.status === 200) {
                try {
                    const updated = await patientAPI.getPatientByID(patientId, token || undefined, true);
                    if (updated?.data) {
                        dispatch(setPatientData(updated.data));
                    }
                } catch (_) {
                    // Keep optimistic update if refetch fails
                }
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to update profile picture.';
            toast.error(msg);
        } finally {
            setUploading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            toast.error('New password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('New password and confirm password do not match.');
            return;
        }
        if (!patientId) {
            toast.error('Patient information not found. Please log in again.');
            return;
        }
        setChangingPassword(true);
        try {
            const payload = {
                patientId: patientId,
                newPassword: newPassword
            };
            await patientAPI.resetPassword(payload);
            toast.success('Password changed successfully.');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to change password.';
            toast.error(msg);
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <div>
            <div className="panel">
                {/* Breadcrumb */}
                <div className="mb-5">
                    <ul className="flex items-center gap-2 text-sm">
                        <li>
                            <a href="/app/dashboard" className="text-primary hover:underline">
                                Dashboard
                            </a>
                        </li>
                        <li>/</li>
                        <li className="text-gray-900 dark:text-white font-medium">Settings</li>
                    </ul>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Profile Picture */}
                    <div className="panel border border-white-light dark:border-[#191e3a] rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Profile Picture
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Upload a new photo. It will appear in the header and on your profile.
                        </p>
                        <form onSubmit={handleUploadPicture} className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="shrink-0 w-24 h-24 rounded-full overflow-hidden bg-white-light dark:bg-[#191e3a] border-2 border-primary/20 flex items-center justify-center">
                                    {profilePhoto && (profilePhoto.startsWith('http') || profilePhoto.startsWith('data:')) ? (
                                        <img
                                            src={profilePhoto}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-3xl font-semibold text-primary">
                                            {patient?.firstName?.charAt(0) || patient?.fullName?.charAt(0) || '?'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 w-full">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="form-input file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:cursor-pointer text-sm"
                                    />
                                    {profileFile && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Selected: {profileFile.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!profileFile || uploading}
                                className="btn btn-primary"
                            >
                                {uploading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Updating...
                                    </span>
                                ) : (
                                    'Update Picture'
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Change Password */}
                    <div className="panel border border-white-light dark:border-[#191e3a] rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Change Password
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Enter your new password and confirm it below.
                        </p>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label htmlFor="newPassword" className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                                    New Password <span className="text-danger">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="newPassword"
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="form-input pr-10"
                                        placeholder="Enter new password"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                        title={showNewPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showNewPassword ? <IconEyeOff className="w-5 h-5" /> : <IconEye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                                    Confirm Password <span className="text-danger">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="form-input pr-10"
                                        placeholder="Confirm new password"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirmPassword ? <IconEyeOff className="w-5 h-5" /> : <IconEye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!newPassword || !confirmPassword || changingPassword}
                                className="btn btn-primary"
                            >
                                {changingPassword ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Updating...
                                    </span>
                                ) : (
                                    'Change Password'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
