import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { deactivatePortalAccount, getPortalAccount, invitePortalAccount } from '../../services/patientAccess.service';
import type { PatientAccountStatus } from '../../types/patientAccess';

type Props = { patientId: string; defaultEmail?: string };

export function PatientPortalAccessBlock({ patientId, defaultEmail = '' }: Props) {
    const [account, setAccount] = useState<PatientAccountStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [email, setEmail] = useState(defaultEmail);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        const res = await getPortalAccount(patientId);
        setLoading(false);
        if (!res.ok) {
            toast.error(res.message);
            return;
        }
        setAccount(res.data);
        if (res.data?.email) setEmail(res.data.email);
    }, [patientId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (defaultEmail && !email) setEmail(defaultEmail);
    }, [defaultEmail, email]);

    async function invite() {
        if (!patientId) return;
        setBusy(true);
        const res = await invitePortalAccount(patientId);
        setBusy(false);
        if (!res.ok) return toast.error(res.message);
        setAccount(res.data);
        toast.success(res.data.emailSent ? 'Invite emailed' : 'Invite created (email not sent — copy link from server logs in dev)');
        if (res.data.inviteToken) {
            toast.message(`Dev invite token available — set-password URL uses token ${res.data.inviteToken.slice(0, 8)}…`);
        }
        await load();
    }

    async function deactivate() {
        if (!patientId) return;
        setBusy(true);
        const res = await deactivatePortalAccount(patientId);
        setBusy(false);
        setConfirmOpen(false);
        if (!res.ok) return toast.error(res.message);
        setAccount(res.data);
        toast.success('Portal access deactivated');
    }

    const status = account?.status || 'none';

    return (
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Patient portal access</h4>
            <p className="mt-0.5 text-xs text-gray-500">Invite the patient to set a password for SMART app authorization (Patient Access API).</p>
            {loading ? (
                <p className="mt-2 text-xs text-gray-500">Loading…</p>
            ) : (
                <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-700 dark:text-gray-200">
                        Status: <span className="font-semibold capitalize">{status}</span>
                        {account?.email ? <span className="text-gray-500"> · {account.email}</span> : null}
                    </p>
                    <div className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Invite email
                        <p className="mt-1 h-9 w-full max-w-md rounded-md border border-gray-200 bg-gray-100 px-2.5 text-xs leading-9 text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                            {email || 'No email on file — add one in Demographics first'}
                        </p>
                        <p className="mt-1 text-[10px] font-normal normal-case text-gray-400">
                            Always sent to the patient's email on file — it can't be redirected elsewhere from here.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {status === 'active' ? (
                            <p className="text-xs text-gray-500">
                                Account is active. To issue a new password, have the patient use "Forgot password" on the portal login page — invites can't reset an active account.
                            </p>
                        ) : (
                            <button
                                type="button"
                                disabled={busy || !email}
                                onClick={() => void invite()}
                                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                            >
                                {status === 'none' || status === 'deactivated' ? 'Send invite' : 'Resend invite'}
                            </button>
                        )}
                        {status === 'active' || status === 'invited' ? (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmOpen(true)}
                                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-60 dark:border-white/10 dark:text-gray-200"
                            >
                                Deactivate
                            </button>
                        ) : null}
                    </div>
                </div>
            )}
            <ConfirmDialog
                open={confirmOpen}
                title="Deactivate portal access"
                message="The patient will no longer be able to authorize SMART apps until invited again."
                detail={account?.email || 'Patient portal account'}
                confirmLabel="Deactivate"
                variant="warning"
                busy={busy}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => void deactivate()}
            />
        </div>
    );
}
