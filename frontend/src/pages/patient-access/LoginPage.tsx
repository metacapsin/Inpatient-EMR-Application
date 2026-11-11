import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { patientAuthAPI } from '../../services/patientApi';

const INPUT =
    'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100';

export default function PatientLoginPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            await patientAuthAPI.login(email.trim(), password);
            toast.success('Signed in');
            const next = params.get('returnTo') || '/patient/authorize';
            // If OAuth params are present, go to authorize; otherwise stay informational.
            if (params.get('client_id')) {
                navigate(`/patient/authorize?${params.toString()}`, { replace: true });
            } else if (params.get('returnTo')) {
                navigate(next, { replace: true });
            } else {
                toast.message('You are signed in. Return to your app or open an authorization link.');
            }
        } catch (err) {
            const ax = err as { response?: { data?: { message?: string } } };
            toast.error(ax.response?.data?.message || 'Invalid email or password');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f7f3ee] to-[#ebe4da] px-4 py-10 dark:from-[#12100e] dark:to-[#1a1816]">
            <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#141210]">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Patient portal sign-in</h1>
                <p className="mt-1 text-sm text-gray-500">Sign in to authorize third-party apps to access your records.</p>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
                    <input type="email" className={`${INPUT} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                </label>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Password
                    <input type="password" className={`${INPUT} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </label>
                <button type="submit" disabled={submitting} className="mt-5 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                    {submitting ? 'Signing in…' : 'Sign in'}
                </button>
                <p className="mt-4 text-center text-xs text-gray-500">
                    Need an invite? Contact your care team. <Link className="text-primary underline" to="/login">Staff login</Link>
                </p>
            </form>
        </div>
    );
}
