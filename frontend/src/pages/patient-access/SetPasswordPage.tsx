import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { patientAuthAPI } from '../../services/patientApi';

const INPUT =
    'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100';

export default function PatientSetPasswordPage() {
    const [params] = useSearchParams();
    const token = useMemo(() => params.get('token') || '', [params]);
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!token) return toast.error('Invite token is missing');
        if (password.length < 10) return toast.error('Password must be at least 10 characters');
        if (password !== confirm) return toast.error('Passwords do not match');
        setSubmitting(true);
        try {
            await patientAuthAPI.setPassword(token, password, confirm);
            toast.success('Password saved — you can sign in');
            navigate('/patient/login', { replace: true });
        } catch (err) {
            const ax = err as { response?: { data?: { message?: string } } };
            toast.error(ax.response?.data?.message || 'Could not set password');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f7f3ee] to-[#ebe4da] px-4 py-10 dark:from-[#12100e] dark:to-[#1a1816]">
            <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#141210]">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Set patient portal password</h1>
                <p className="mt-1 text-sm text-gray-500">Choose a password to access your health information and authorize apps.</p>
                {!token ? <p className="mt-3 text-sm text-red-600">This link is missing a token. Request a new invite from your care team.</p> : null}
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    New password
                    <input type="password" className={`${INPUT} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
                </label>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Confirm password
                    <input type="password" className={`${INPUT} mt-1`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={10} />
                </label>
                <button type="submit" disabled={submitting || !token} className="mt-5 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                    {submitting ? 'Saving…' : 'Save password'}
                </button>
                <p className="mt-4 text-center text-xs text-gray-500">
                    Already set up? <Link className="text-primary underline" to="/patient/login">Sign in</Link>
                </p>
            </form>
        </div>
    );
}
