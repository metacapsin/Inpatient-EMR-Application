import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import { IRootState } from '../store';
import { setPatientData } from '../store/authSlice';
import { patientAPI, practiceAPI, commonAPI } from '../services/api';
// import IconEye from '../components/Icon/IconEye';
// import IconEyeOff from '../components/Icon/IconEyeOff';

const Settings: React.FC = () => {
    const dispatch = useDispatch();
    const patientData = useSelector((state: IRootState) => state.auth.patientData);
    const user = useSelector((state: IRootState) => state.auth.user);
    // const token = useSelector((state: IRootState) => state.auth.token);

    const patient = patientData?.data ?? patientData;
    const patientId = patient?._id ?? user?.patientId ?? (user as any)?.patientId;

    const [practiceInfo, setPracticeInfo] = useState<any>(null);
    const [practiceLoading, setPracticeLoading] = useState(true);
    const [practiceEdit, setPracticeEdit] = useState(false);
    const [practiceForm, setPracticeForm] = useState<any>({});
    const [practiceSaving, setPracticeSaving] = useState(false);
    const [practiceErrors, setPracticeErrors] = useState<any>({});
    const [states, setStates] = useState<any[]>([]);
    const [stateOpen, setStateOpen] = useState(false);
    const stateRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (stateRef.current && !stateRef.current.contains(e.target as Node)) setStateOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        practiceAPI.getList()
            .then((res) => {
                const list = res.data?.data ?? res.data ?? [];
                setPracticeInfo(list[0] ?? null);
            })
            .catch(() => {})
            .finally(() => setPracticeLoading(false));
    }, []);

    useEffect(() => {
        if (practiceEdit && practiceInfo?._id) {
            setPracticeErrors({});
            Promise.all([
                practiceAPI.getById(practiceInfo._id),
                commonAPI.getStates('US'),
            ]).then(([infoRes, statesRes]) => {
                const detail = infoRes.data?.data ?? infoRes.data ?? practiceInfo;
                setPracticeForm({
                    ...detail,
                    phone: detail.phone ? autoFormatPhone(detail.phone) : '',
                    fax: detail.fax ? autoFormatPhone(detail.fax) : '',
                });
                setStates(statesRes.data?.data ?? statesRes.data ?? []);
            }).catch(() => {
                setPracticeForm({
                    ...practiceInfo,
                    phone: practiceInfo.phone ? autoFormatPhone(practiceInfo.phone) : '',
                    fax: practiceInfo.fax ? autoFormatPhone(practiceInfo.fax) : '',
                });
            });
        }
    }, [practiceEdit]);

    const formatPhone = (val: string) => {
        if (!val) return '--';
        const d = val.replace(/\D/g, '').slice(0, 10);
        if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
        return val;
    };

    const autoFormatPhone = (val: string) => {
        const d = val.replace(/\D/g, '').slice(0, 10);
        if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
        if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
        if (d.length > 0) return `(${d}`;
        return '';
    };

    const autoFormatZip = (val: string) => {
        const d = val.replace(/\D/g, '').slice(0, 9);
        if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
        return d;
    };

    const autoFormatEIN = (val: string) => {
        const d = val.replace(/\D/g, '').slice(0, 9);
        if (d.length > 2) return `${d.slice(0, 2)}-${d.slice(2)}`;
        return d;
    };

    const handleFieldChange = (key: string, raw: string) => {
        let val = raw;
        if (key === 'phone' || key === 'fax') val = autoFormatPhone(raw);
        else if (key === 'zip') val = autoFormatZip(raw);
        else if (key === 'ein') val = autoFormatEIN(raw);
        else if (key === 'groupNpi') val = raw.replace(/\D/g, '').slice(0, 10);
        setPracticeForm((p: any) => ({ ...p, [key]: val }));
        if (practiceErrors[key]) setPracticeErrors((p: any) => ({ ...p, [key]: '' }));
    };

    const handlePracticeSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: any = {};
        const f = practiceForm;

        const namePattern = /^(?!\s)(?!.*\s$).+$/;
        const addressPattern = /^(?! )[A-Za-z0-9,.\/\-#]+(?: [A-Za-z0-9,.\/\-#]+)*(?<! )$/;
        const cityPattern = /^(?! )[A-Za-z.'\-]+(?: [A-Za-z.'\-]+)*(?<! )$/;
        const zipPattern = /^\d{5}(-\d{4})?$/;
        const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
        const einPattern = /^\d{2}-\d{7}$/;
        const npiPattern = /^[1-9]\d{9}$/;

        if (!f.name?.trim()) { errs.name = 'Name is required.'; }
        else if (f.name.length < 3) { errs.name = 'Name must be at least 3 characters.'; }
        else if (f.name.length > 35) { errs.name = 'Name must be at most 35 characters.'; }
        else if (!namePattern.test(f.name)) { errs.name = 'Name cannot have leading or trailing spaces.'; }

        if (!f.address?.trim()) { errs.address = 'Address is required.'; }
        else if (f.address.length < 5) { errs.address = 'Address must be at least 5 characters.'; }
        else if (f.address.length > 250) { errs.address = 'Address must be at most 250 characters.'; }
        else if (!addressPattern.test(f.address)) { errs.address = 'Address: only alphanumeric and , . - # / allowed, no leading/trailing spaces.'; }

        if (f.address2?.trim()) {
            if (f.address2.length < 5) { errs.address2 = 'Address 2 must be at least 5 characters.'; }
            else if (f.address2.length > 250) { errs.address2 = 'Address 2 must be at most 250 characters.'; }
            else if (!addressPattern.test(f.address2)) { errs.address2 = 'Address 2: only alphanumeric and , . - # / allowed, no leading/trailing spaces.'; }
        }

        if (!f.city?.trim()) { errs.city = 'City is required.'; }
        else if (f.city.length < 3) { errs.city = 'City must be at least 3 characters.'; }
        else if (f.city.length > 50) { errs.city = 'City must be at most 50 characters.'; }
        else if (!cityPattern.test(f.city)) { errs.city = "City: only letters, . ' - allowed, no leading/trailing spaces."; }

        if (!f.state?.trim()) { errs.state = 'State is required.'; }

        if (!f.zip?.trim()) { errs.zip = 'Zip is required.'; }
        else if (!zipPattern.test(f.zip)) { errs.zip = 'Zip must be 12345 or 12345-6789.'; }

        if (!f.phone?.trim()) { errs.phone = 'Phone is required.'; }
        else {
            const digits = f.phone.replace(/\D/g, '');
            if (digits.length !== 10) { errs.phone = 'Phone must be a valid 10-digit number.'; }
            else if (!phonePattern.test(f.phone)) { errs.phone = 'Phone must be a valid 10-digit number.'; }
            else if (digits[0] === '0' || digits[0] === '1') { errs.phone = 'Area code cannot start with 0 or 1.'; }
            else if (digits[3] === '0' || digits[3] === '1') { errs.phone = 'Exchange code cannot start with 0 or 1.'; }
        }

        if (f.fax?.trim() && f.fax.length > 14) { errs.fax = 'Fax must be at most 14 characters.'; }

        if (f.ein?.trim() && !einPattern.test(f.ein)) { errs.ein = 'EIN must be in format 12-3456789.'; }

        if (f.groupNpi?.trim() && !npiPattern.test(f.groupNpi)) { errs.groupNpi = 'NPI must be exactly 10 digits, first digit 1-9.'; }

        if (Object.keys(errs).length) { setPracticeErrors(errs); return; }
        setPracticeSaving(true);
        try {
            const res = await practiceAPI.update(practiceInfo._id, practiceForm);
            const updated = res.data?.data ?? res.data ?? practiceForm;
            setPracticeInfo({ ...practiceForm, ...updated });
            setPracticeEdit(false);
            toast.success('Practice information updated successfully.');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update practice information.');
        } finally {
            setPracticeSaving(false);
        }
    };

    // const [profileFile, setProfileFile] = useState<File | null>(null);
    // const [profilePreview, setProfilePreview] = useState<string | null>(null);
    // const [uploading, setUploading] = useState(false);
    // const fileInputRef = useRef<HTMLInputElement>(null);

    // const [newPassword, setNewPassword] = useState('');
    // const [confirmPassword, setConfirmPassword] = useState('');
    // const [showNewPassword, setShowNewPassword] = useState(false);
    // const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    // const [changingPassword, setChangingPassword] = useState(false);

    // const profilePhoto =
    //     profilePreview ??
    //     patient?.profilePictureUrl ??
    //     patient?.profilePhoto ??
    //     patient?.photo ??
    //     null;

    // const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //     const file = e.target.files?.[0];
    //     if (file) {
    //         if (!file.type.startsWith('image/')) {
    //             toast.error('Please select an image file (e.g. JPG, PNG)');
    //             return;
    //         }
    //         setProfileFile(file);
    //         const reader = new FileReader();
    //         reader.onloadend = () => setProfilePreview(reader.result as string);
    //         reader.readAsDataURL(file);
    //     } else {
    //         setProfileFile(null);
    //         setProfilePreview(null);
    //     }
    // };

    // const handleUploadPicture = async (e: React.FormEvent) => {
    //     e.preventDefault();
    //     if (!patientId) {
    //         toast.error('Patient information not found. Please log in again.');
    //         return;
    //     }
    //     if (!profileFile) {
    //         toast.error('Please select an image to upload.');
    //         return;
    //     }
    //     setUploading(true);
    //     const previewUrl = profilePreview;
    //     try {
    //         const formData = new FormData();
    //         formData.append('profilePicture', profileFile, profileFile.name || 'image');
    //         const updateRes = await patientAPI.updateProfilePicture(patientId, formData);
    //         if (updateRes.status === 200) {
    //             const currentData = patientData || { data: {} };
    //             const currentPatient = currentData?.data ?? currentData;
    //             const optimisticData = {
    //                 ...currentData,
    //                 data: {
    //                     ...(typeof currentPatient === 'object' && currentPatient !== null ? currentPatient : {}),
    //                     profilePictureUrl: previewUrl,
    //                 },
    //             };
    //             dispatch(setPatientData(optimisticData));
    //         }
    //         toast.success('Profile picture updated successfully.');
    //         setProfileFile(null);
    //         setProfilePreview(null);
    //         if (fileInputRef.current) fileInputRef.current.value = '';
    //         if (updateRes.status === 200) {
    //             try {
    //                 const updated = await patientAPI.getPatientByID(patientId, token || undefined, true);
    //                 if (updated?.data) {
    //                     dispatch(setPatientData(updated.data));
    //                 }
    //             } catch (_) {
    //                 // Keep optimistic update if refetch fails
    //             }
    //         }
    //     } catch (err: any) {
    //         const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to update profile picture.';
    //         toast.error(msg);
    //     } finally {
    //         setUploading(false);
    //     }
    // };

    // const handleChangePassword = async (e: React.FormEvent) => {
    //     e.preventDefault();
    //     if (newPassword.length < 6) {
    //         toast.error('New password must be at least 6 characters.');
    //         return;
    //     }
    //     if (newPassword !== confirmPassword) {
    //         toast.error('New password and confirm password do not match.');
    //         return;
    //     }
    //     if (!patientId) {
    //         toast.error('Patient information not found. Please log in again.');
    //         return;
    //     }
    //     setChangingPassword(true);
    //     try {
    //         const payload = {
    //             patientId: patientId,
    //             newPassword: newPassword
    //         };
    //         await patientAPI.resetPassword(payload);
    //         toast.success('Password changed successfully.');
    //         setNewPassword('');
    //         setConfirmPassword('');
    //     } catch (err: any) {
    //         const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to change password.';
    //         toast.error(msg);
    //     } finally {
    //         setChangingPassword(false);
    //     }
    // };

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

                <div className="mb-6 rounded-xl border border-white-light dark:border-[#191e3a] p-4">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Facility management</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        Manage wards, rooms, and beds for inpatient placement (mock-backed until facility APIs are live).
                    </p>
                    <NavLink
                        to="/app/settings/facility"
                        className="inline-flex items-center rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15"
                    >
                        Open facility settings
                    </NavLink>
                </div>

                {/* Practice Information Card */}
                <div className="mb-6 rounded-xl border border-white-light dark:border-[#191e3a] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Practice Information</h2>
                        {!practiceEdit && practiceInfo && (
                            <button
                                type="button"
                                onClick={() => setPracticeEdit(true)}
                                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/15"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                            </button>
                        )}
                        {practiceEdit && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    form="practice-form"
                                    disabled={practiceSaving}
                                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/15 disabled:opacity-60"
                                >
                                    {practiceSaving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPracticeEdit(false)}
                                    className="flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger/15"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {practiceLoading ? (
                        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
                    ) : !practiceEdit ? (
                        practiceInfo ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                {[
                                    { label: 'Name', value: practiceInfo.name },
                                    { label: 'Address', value: [practiceInfo.address, practiceInfo.address2].filter(Boolean).join(', ') },
                                    { label: 'City', value: practiceInfo.city },
                                    { label: 'State', value: practiceInfo.state },
                                    { label: 'Zip', value: practiceInfo.zip },
                                    { label: 'Phone No.', value: formatPhone(practiceInfo.phone) },
                                    { label: 'Fax No.', value: practiceInfo.fax ? formatPhone(practiceInfo.fax) : '--' },
                                    { label: 'EIN', value: practiceInfo.ein || '--' },
                                    { label: 'National Provider Identifier', value: practiceInfo.groupNpi || '--' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex flex-col gap-0.5">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                                        <span className="text-gray-900 dark:text-white">{value || '--'}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No practice information found.</p>
                        )
                    ) : (
                        <form id="practice-form" onSubmit={handlePracticeSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {([
                                { label: 'Name', key: 'name', required: true },
                                { label: 'Address', key: 'address', required: true },
                                { label: 'Address 2', key: 'address2' },
                                { label: 'City', key: 'city', required: true },
                            ] as { label: string; key: string; required?: boolean }[]).map(({ label, key, required }) => (
                                <div key={key}>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {label} {required && <span className="text-danger">*</span>}
                                    </label>
                                    <input
                                        className={`form-input w-full ${practiceErrors[key] ? 'border-red-500' : ''}`}
                                        value={practiceForm[key] ?? ''}
                                        onChange={(e) => handleFieldChange(key, e.target.value)}
                                    />
                                    {practiceErrors[key] && <p className="mt-1 text-xs text-red-500">{practiceErrors[key]}</p>}
                                </div>
                            ))}

                            {/* State dropdown */}
                            <div ref={stateRef} className="relative">
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">State <span className="text-danger">*</span></label>
                                <button
                                    type="button"
                                    className="form-input w-full h-9 text-left flex items-center justify-between"
                                    onClick={() => setStateOpen((o) => !o)}
                                >
                                    <span className={practiceForm.state ? '' : 'text-gray-400'}>
                                        {practiceForm.state
                                            ? (states.find((s: any) => (s.abbreviation ?? s.code ?? s.name) === practiceForm.state)?.name ?? practiceForm.state)
                                            : 'Select state…'}
                                    </span>
                                    <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {practiceErrors.state && <p className="mt-1 text-xs text-red-500">{practiceErrors.state}</p>}
                                {stateOpen && (
                                    <ul className="absolute z-50 mt-1 w-full rounded-lg border border-white-light dark:border-[#191e3a] bg-white dark:bg-[#1b2e4b] shadow-lg max-h-48 overflow-y-auto">
                                        <li
                                            className="cursor-pointer px-3 py-1.5 text-sm text-gray-400 hover:bg-primary/10"
                                            onMouseDown={() => { setPracticeForm((p: any) => ({ ...p, state: '' })); setStateOpen(false); }}
                                        >Select state…</li>
                                        {states.map((s: any) => {
                                            const val = s.abbreviation ?? s.code ?? s.name;
                                            return (
                                                <li
                                                    key={s._id}
                                                    className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-primary/10 ${practiceForm.state === val ? 'bg-primary/10 text-primary font-medium' : 'text-gray-900 dark:text-white'}`}
                                                    onMouseDown={() => { setPracticeForm((p: any) => ({ ...p, state: val })); setStateOpen(false); }}
                                                >{s.name}</li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            {([
                                { label: 'Zip', key: 'zip', required: true },
                                { label: 'Phone', key: 'phone', required: true },
                                { label: 'Fax', key: 'fax' },
                                { label: 'EIN', key: 'ein' },
                                { label: 'National Provider Identifier', key: 'groupNpi' },
                            ] as { label: string; key: string; required?: boolean }[]).map(({ label, key, required }) => (
                                <div key={key}>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {label} {required && <span className="text-danger">*</span>}
                                    </label>
                                    <input
                                        className={`form-input w-full ${practiceErrors[key] ? 'border-red-500' : ''}`}
                                        value={practiceForm[key] ?? ''}
                                        placeholder={
                                            key === 'zip' ? '12345 or 12345-6789' :
                                            key === 'phone' || key === 'fax' ? '(123) 456-7890' :
                                            key === 'ein' ? '12-3456789' :
                                            key === 'groupNpi' ? '10-digit NPI' : undefined
                                        }
                                        inputMode={key === 'groupNpi' ? 'numeric' : undefined}
                                        onChange={(e) => handleFieldChange(key, e.target.value)}
                                    />
                                    {practiceErrors[key] && <p className="mt-1 text-xs text-red-500">{practiceErrors[key]}</p>}
                                </div>
                            ))}


                        </form>
                    )}
                </div>



                {/* Profile Picture and Change Password sections commented out */}
                {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    Profile Picture
                    <div className="panel border border-white-light dark:border-[#191e3a] rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Profile Picture</h2>
                        ...
                    </div>
                    Change Password
                    <div className="panel border border-white-light dark:border-[#191e3a] rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Change Password</h2>
                        ...
                    </div>
                </div> */}
            </div>
        </div>
    );
};

export default Settings;
