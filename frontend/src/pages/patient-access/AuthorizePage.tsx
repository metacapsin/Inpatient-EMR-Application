import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getPatientToken, patientAuthAPI, patientOAuthAPI } from '../../services/patientApi';
import { SCOPE_LABELS } from '../../types/patientAccess';

export default function PatientAuthorizePage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);

    const clientId = params.get('client_id') || '';
    const redirectUri = params.get('redirect_uri') || '';
    const scope = params.get('scope') || '';
    const state = params.get('state') || '';
    const codeChallenge = params.get('code_challenge') || '';
    const codeChallengeMethod = params.get('code_challenge_method') || 'S256';
    const clientName = params.get('client_name') || clientId || 'Third-party application';

    const scopes = useMemo(() => scope.split(/\s+/).filter(Boolean), [scope]);
    const loggedIn = Boolean(getPatientToken());

    async function decide(allow: boolean) {
        if (!loggedIn) {
            navigate(`/patient/login?${params.toString()}`, { replace: true });
            return;
        }
        setBusy(true);
        try {
            const redirectUrl = await patientOAuthAPI.decide({
                allow,
                client_id: clientId,
                redirect_uri: redirectUri,
                scope,
                state: state || undefined,
                code_challenge: codeChallenge,
                code_challenge_method: codeChallengeMethod,
            });
            if (!allow) toast.message('Access denied');
            window.location.href = redirectUrl;
        } catch (err) {
            const ax = err as { response?: { data?: { message?: string; error_description?: string } } };
            toast.error(ax.response?.data?.message || ax.response?.data?.error_description || 'Authorization failed');
            setBusy(false);
        }
    }

    if (!clientId || !redirectUri || !codeChallenge) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4">
                <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
                    Invalid authorization request. Missing client, redirect URI, or PKCE challenge.
                    <div className="mt-3">
                        <Link to="/patient/login" className="text-primary underline">
                            Patient login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f7f3ee] to-[#ebe4da] px-4 py-10 dark:from-[#12100e] dark:to-[#1a1816]">
            <div className="w-full max-w-lg rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#141210]">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Allow app access?</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <strong>{clientName}</strong> is requesting permission to access your health information.
                </p>
                <ul className="mt-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    {scopes.map((s) => (
                        <li key={s} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                            <span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{SCOPE_LABELS[s] || s}</span>
                                <span className="mt-0.5 block font-mono text-[10px] text-gray-500">{s}</span>
                            </span>
                        </li>
                    ))}
                </ul>
                {!loggedIn ? (
                    <p className="mt-4 text-sm text-amber-700">
                        You need to{' '}
                        <Link className="underline" to={`/patient/login?${params.toString()}`}>
                            sign in
                        </Link>{' '}
                        before allowing access.
                    </p>
                ) : null}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            patientAuthAPI.logout();
                            void decide(false);
                        }}
                        className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-gray-200"
                    >
                        Deny
                    </button>
                    <button
                        type="button"
                        disabled={busy || !loggedIn}
                        onClick={() => void decide(true)}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                        {busy ? 'Working…' : 'Allow'}
                    </button>
                </div>
            </div>
        </div>
    );
}
