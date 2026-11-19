import { forwardRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, LogOut } from 'lucide-react';
import { SettingsCardHeader } from './SettingsCardHeader';
import { settingsFieldLabelClass, settingsGhostButtonClass, settingsSecondaryCardClass } from '../../../styles/settingsPageClasses';
import { confirmMfa, disableMfa, enrollMfa, signOutAllDevices, type MfaEnrollment } from '../../../services/security.service';
import { setUser, logoutUser } from '../../../store/authSlice';
import type { AppDispatch, IRootState } from '../../../store';

const INPUT = 'h-9 w-full rounded-lg border border-emr-border/90 bg-white px-2.5 text-[13px] text-emr-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-100';

export const SecurityCard = forwardRef<HTMLElement>(function SecurityCard(_, ref) {
    const dispatch = useDispatch<AppDispatch>();
    const user = useSelector((s: IRootState) => s.auth.user);
    const mfaEnabled = Boolean(user?.mfaEnabled);

    const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
    const [code, setCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [disablePassword, setDisablePassword] = useState('');
    const [showDisable, setShowDisable] = useState(false);
    const [busy, setBusy] = useState(false);

    async function startEnroll() {
        setBusy(true);
        const res = await enrollMfa();
        setBusy(false);
        if (!res.ok) return toast.error(res.message);
        setEnrollment(res.data);
    }

    async function confirmEnroll() {
        if (!code.trim()) return;
        setBusy(true);
        const res = await confirmMfa(code.trim());
        setBusy(false);
        if (!res.ok) return toast.error(res.message);
        setBackupCodes(res.data.backupCodes);
        setEnrollment(null);
        setCode('');
        if (user) dispatch(setUser({ ...user, mfaEnabled: true }));
        toast.success('Two-factor authentication enabled');
    }

    async function confirmDisable() {
        if (!disablePassword.trim()) return;
        setBusy(true);
        const res = await disableMfa(disablePassword.trim());
        setBusy(false);
        if (!res.ok) return toast.error(res.message);
        setShowDisable(false);
        setDisablePassword('');
        if (user) dispatch(setUser({ ...user, mfaEnabled: false }));
        toast.success('Two-factor authentication disabled');
    }

    async function handleSignOutAll() {
        setBusy(true);
        const res = await signOutAllDevices();
        setBusy(false);
        if (!res.ok) return toast.error(res.message);
        toast.success('Signed out everywhere, including this device');
        // The access token and refresh cookie this session was using are now both invalid —
        // clear local state the same way a normal sign-out does rather than leaving a dead session.
        void dispatch(logoutUser());
    }

    return (
        <section ref={ref} id="settings-security" className={settingsSecondaryCardClass} aria-labelledby="security-heading">
            <SettingsCardHeader title="Security" description="Two-factor authentication and active sessions." />
            <h2 id="security-heading" className="sr-only">
                Security
            </h2>
            <div className="space-y-6 px-4 py-4 sm:px-5 sm:py-5">
                <div>
                    <div className="flex items-center gap-2">
                        {mfaEnabled ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldOff className="h-4 w-4 text-amber-600" />}
                        <span className="text-sm font-medium text-emr-text dark:text-gray-100">
                            Two-factor authentication is {mfaEnabled ? 'enabled' : 'disabled'}
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-emr-muted dark:text-gray-400">
                        Optional, per-account. Adds a 6-digit code from an authenticator app to sign-in.
                    </p>

                    {backupCodes ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                            <p className="font-semibold">Save these backup codes now</p>
                            <p className="mt-1 text-xs">Each works once if you lose access to your authenticator app. They won't be shown again.</p>
                            <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">
                                {backupCodes.map((c) => (
                                    <span key={c}>{c}</span>
                                ))}
                            </div>
                            <button type="button" className="mt-2 text-xs underline" onClick={() => setBackupCodes(null)}>
                                Done
                            </button>
                        </div>
                    ) : mfaEnabled ? (
                        showDisable ? (
                            <div className="mt-3 grid max-w-sm gap-2">
                                <label>
                                    <span className={settingsFieldLabelClass}>Confirm your password to disable</span>
                                    <input
                                        type="password"
                                        className={INPUT}
                                        value={disablePassword}
                                        onChange={(e) => setDisablePassword(e.target.value)}
                                    />
                                </label>
                                <div className="flex gap-2">
                                    <button type="button" disabled={busy} className={settingsGhostButtonClass} onClick={() => void confirmDisable()}>
                                        Disable 2FA
                                    </button>
                                    <button type="button" className="text-xs text-emr-muted" onClick={() => setShowDisable(false)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button type="button" className={`mt-3 ${settingsGhostButtonClass}`} onClick={() => setShowDisable(true)}>
                                <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                                Disable 2FA
                            </button>
                        )
                    ) : enrollment ? (
                        <div className="mt-3 grid max-w-sm gap-2">
                            <p className="text-xs text-emr-muted dark:text-gray-400">
                                Scan or enter this manually in your authenticator app, then enter the 6-digit code it shows.
                            </p>
                            <div className="rounded-lg border border-emr-border/80 bg-emr-hover/30 p-2 font-mono text-xs break-all dark:border-white/10 dark:bg-white/[0.03]">
                                {enrollment.secret}
                            </div>
                            <label>
                                <span className={settingsFieldLabelClass}>6-digit code</span>
                                <input className={INPUT} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoFocus />
                            </label>
                            <div className="flex gap-2">
                                <button type="button" disabled={busy || !code.trim()} className={settingsGhostButtonClass} onClick={() => void confirmEnroll()}>
                                    Confirm &amp; enable
                                </button>
                                <button type="button" className="text-xs text-emr-muted" onClick={() => setEnrollment(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" disabled={busy} className={`mt-3 ${settingsGhostButtonClass}`} onClick={() => void startEnroll()}>
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                            Enable 2FA
                        </button>
                    )}
                </div>

                <div className="border-t border-emr-border/70 pt-4 dark:border-white/10">
                    <p className="text-sm font-medium text-emr-text dark:text-gray-100">Active sessions</p>
                    <p className="mt-1 text-xs text-emr-muted dark:text-gray-400">
                        Revokes every sign-in for your account everywhere, including this device — you'll need to log in again here too.
                    </p>
                    <button type="button" disabled={busy} className={`mt-3 ${settingsGhostButtonClass}`} onClick={() => void handleSignOutAll()}>
                        <LogOut className="h-3.5 w-3.5" aria-hidden />
                        Sign out of all devices
                    </button>
                </div>
            </div>
        </section>
    );
});
