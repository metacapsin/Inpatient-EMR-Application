import { forwardRef, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { SettingsCardHeader } from './SettingsCardHeader';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { settingsFieldLabelClass, settingsGhostButtonClass, settingsSecondaryCardClass } from '../../../styles/settingsPageClasses';
import { createSmartClient, deleteSmartClient, listSmartClients, updateSmartClient } from '../../../services/patientAccess.service';
import { SMART_SCOPES, type SmartClient } from '../../../types/patientAccess';
import { useSelector } from 'react-redux';
import type { IRootState } from '../../../store';

const INPUT = 'h-9 w-full rounded-lg border border-emr-border/90 bg-white px-2.5 text-[13px] text-emr-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-100';

/** Admin registry for SMART App Launch clients (Connected Apps). */
export const ConnectedAppsCard = forwardRef<HTMLElement>(function ConnectedAppsCard(_, ref) {
    const role = useSelector((s: IRootState) => s.auth.role || s.auth.user?.role);
    const isAdmin = role === 'admin';
    const [rows, setRows] = useState<SmartClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createdSecret, setCreatedSecret] = useState<{ clientId: string; secret?: string } | null>(null);
    const [form, setForm] = useState({
        name: '',
        redirectUris: 'http://localhost:3456/callback',
        scopes: 'openid fhirUser launch/patient offline_access patient/*.read',
        isConfidential: false,
    });
    const [deleteTarget, setDeleteTarget] = useState<SmartClient | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listSmartClients();
        setLoading(false);
        if (!res.ok) {
            toast.error(res.message);
            return;
        }
        setRows(res.data);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!isAdmin) return toast.error('Only admins can register apps');
        if (!form.name.trim()) return toast.error('App name is required');
        const redirectUris = form.redirectUris
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (!redirectUris.length) return toast.error('At least one redirect URI is required');
        const allowedScopes = form.scopes
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
        setSaving(true);
        const r = await createSmartClient({
            name: form.name.trim(),
            redirectUris,
            allowedScopes,
            isConfidential: form.isConfidential,
        });
        setSaving(false);
        if (!r.ok) return toast.error(r.message);
        setCreatedSecret({ clientId: r.data.clientId, secret: r.data.clientSecret });
        toast.success('App registered');
        setForm({ name: '', redirectUris: 'http://localhost:3456/callback', scopes: 'openid fhirUser launch/patient offline_access patient/*.read', isConfidential: false });
        setAdding(false);
        await load();
    }

    async function deactivate(c: SmartClient) {
        if (!isAdmin) return;
        const r = await updateSmartClient(c.id, { isActive: false });
        if (!r.ok) return toast.error(r.message);
        toast.success(`${c.name} deactivated`);
        await load();
    }

    async function removeConfirmed() {
        if (!isAdmin || !deleteTarget) return;
        setDeleting(true);
        const r = await deleteSmartClient(deleteTarget.id);
        setDeleting(false);
        if (!r.ok) return toast.error(r.message);
        setDeleteTarget(null);
        toast.success('App deleted');
        await load();
    }

    return (
        <section ref={ref} id="settings-connected-apps" className={settingsSecondaryCardClass} aria-labelledby="connected-apps-heading">
            <SettingsCardHeader
                title="Connected Apps"
                description="Register third-party SMART on FHIR applications. Client secrets are shown only once at creation."
                actions={
                    isAdmin ? (
                        <button type="button" className={settingsGhostButtonClass} onClick={() => setAdding((v) => !v)}>
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            {adding ? 'Close' : 'Register app'}
                        </button>
                    ) : null
                }
            />
            <h2 id="connected-apps-heading" className="sr-only">
                Connected Apps
            </h2>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                {!isAdmin ? <p className="text-xs text-amber-700 dark:text-amber-300">View only — app registration requires an admin account.</p> : null}
                {createdSecret ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                        <p className="font-semibold">Copy these credentials now</p>
                        <p className="mt-1 font-mono text-xs">client_id: {createdSecret.clientId}</p>
                        {createdSecret.secret ? <p className="mt-1 font-mono text-xs">client_secret: {createdSecret.secret}</p> : <p className="mt-1 text-xs">Public client — no secret.</p>}
                        <button type="button" className="mt-2 text-xs underline" onClick={() => setCreatedSecret(null)}>
                            Dismiss
                        </button>
                    </div>
                ) : null}
                {adding ? (
                    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-emr-border/80 bg-emr-hover/30 p-3 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2">
                        <label className="sm:col-span-2">
                            <span className={settingsFieldLabelClass}>App name *</span>
                            <input className={INPUT} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                        </label>
                        <label className="sm:col-span-2">
                            <span className={settingsFieldLabelClass}>Redirect URIs * (one per line)</span>
                            <textarea className={`${INPUT} h-20 py-2`} value={form.redirectUris} onChange={(e) => setForm((f) => ({ ...f, redirectUris: e.target.value }))} />
                        </label>
                        <label className="sm:col-span-2">
                            <span className={settingsFieldLabelClass}>Allowed scopes (space-separated)</span>
                            <input className={INPUT} value={form.scopes} onChange={(e) => setForm((f) => ({ ...f, scopes: e.target.value }))} list="smart-scope-hints" />
                            <datalist id="smart-scope-hints">
                                {SMART_SCOPES.map((s) => (
                                    <option key={s} value={s} />
                                ))}
                            </datalist>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-emr-text">
                            <input type="checkbox" checked={form.isConfidential} onChange={(e) => setForm((f) => ({ ...f, isConfidential: e.target.checked }))} />
                            Confidential client (issues a client secret)
                        </label>
                        <div className="sm:col-span-2 flex justify-end">
                            <button type="submit" disabled={saving} className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                                {saving ? 'Saving…' : 'Create app'}
                            </button>
                        </div>
                    </form>
                ) : null}
                {loading ? (
                    <p className="text-sm text-gray-500">Loading apps…</p>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-gray-500">No connected apps registered yet.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-emr-border/80 dark:border-white/10">
                        <table className="min-w-full text-left text-[13px]">
                            <thead className="bg-emr-hover/40 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-white/[0.03]">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">Name</th>
                                    <th className="px-3 py-2 font-semibold">Client ID</th>
                                    <th className="px-3 py-2 font-semibold">Redirects</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                    <th className="px-3 py-2 font-semibold" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((c) => (
                                    <tr key={c.id} className="border-t border-emr-border/60 dark:border-white/[0.06]">
                                        <td className="px-3 py-2 font-medium">{c.name}</td>
                                        <td className="px-3 py-2 font-mono text-[11px]">{c.clientId}</td>
                                        <td className="max-w-xs px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300">
                                            {(c.redirectUris || []).join(', ')}
                                        </td>
                                        <td className="px-3 py-2">{c.isActive ? 'Active' : 'Inactive'}</td>
                                        <td className="px-3 py-2 text-right">
                                            {isAdmin ? (
                                                <div className="flex justify-end gap-1">
                                                    {c.isActive ? (
                                                        <button type="button" className="text-xs text-amber-700 underline" onClick={() => void deactivate(c)}>
                                                            Deactivate
                                                        </button>
                                                    ) : null}
                                                    <button type="button" className="inline-flex items-center gap-1 text-xs text-red-700" onClick={() => setDeleteTarget(c)}>
                                                        <Trash2 className="h-3 w-3" aria-hidden /> Delete
                                                    </button>
                                                </div>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <ConfirmDialog
                open={Boolean(deleteTarget)}
                title="Delete connected app"
                message="This removes the SMART client registration. Existing authorizations may stop working."
                detail={deleteTarget?.name}
                confirmLabel="Delete app"
                variant="danger"
                busy={deleting}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => void removeConfirmed()}
            />
        </section>
    );
});
