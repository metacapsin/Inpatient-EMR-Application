import { forwardRef, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Send, Trash2 } from 'lucide-react';
import { SettingsCardHeader } from './SettingsCardHeader';
import { settingsFieldLabelClass, settingsGhostButtonClass, settingsSecondaryCardClass } from '../../../styles/settingsPageClasses';
import {
    createRecipient,
    deleteRecipient,
    listAdtNotifications,
    listRecipients,
    RECIPIENT_KIND_LABELS,
    testRecipient,
    TRANSPORT_LABELS,
    updateRecipient,
    type AdtNotificationLogRow,
    type NotificationRecipient,
    type NotificationRecipientInput,
    type RecipientKind,
    type RecipientTransport,
} from '../../../services/adtNotifications.service';
import { AdtNotificationLogTable } from '../../../components/adt/AdtNotificationLogTable';

const INPUT = 'h-9 w-full rounded-lg border border-emr-border/90 bg-white px-2.5 text-[13px] text-emr-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-100';
const EMPTY: NotificationRecipientInput = { name: '', kind: 'post_acute', transport: 'stub', endpoint: '', authHeaderSecret: '', enabled: true };

const endpointHint: Record<RecipientTransport, string> = {
    stub: 'No endpoint needed — messages are logged only.',
    https_webhook: 'https://partner.example.com/adt (HL7 posted as text; optional Authorization header below)',
    mllp: 'host:port of the receiving HL7 interface engine',
    email: 'Email address that receives the HL7 message body',
    direct: 'Direct Secure Messaging address (transport not configured yet)',
};

/** CMS CoP 42 CFR 482.24(d): who gets notified on admission / transfer / discharge, and the delivery log. */
export const CareNotificationsCard = forwardRef<HTMLElement>(function CareNotificationsCard(_, ref) {
    const [rows, setRows] = useState<NotificationRecipient[]>([]);
    const [log, setLog] = useState<AdtNotificationLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<NotificationRecipientInput>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [r, l] = await Promise.all([listRecipients(), listAdtNotifications({ limit: 25 })]);
            setRows(r);
            setLog(l);
        } catch {
            toast.error('Could not load care notification settings');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, []);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) return toast.error('Recipient name is required');
        setSaving(true);
        const r = await createRecipient({ ...form, endpoint: form.endpoint?.trim() || undefined, authHeaderSecret: form.authHeaderSecret?.trim() || undefined });
        setSaving(false);
        if (!r.ok) return toast.error(r.message);
        toast.success('Recipient added');
        setForm(EMPTY);
        setAdding(false);
        await load();
    }

    async function toggle(rcpt: NotificationRecipient) {
        const r = await updateRecipient(rcpt.id, { enabled: !rcpt.enabled });
        if (!r.ok) return toast.error(r.message);
        await load();
    }

    async function remove(rcpt: NotificationRecipient) {
        const r = await deleteRecipient(rcpt.id);
        if (!r.ok) return toast.error(r.message);
        toast.success(`${rcpt.name} removed`);
        await load();
    }

    async function sendTest(rcpt: NotificationRecipient) {
        setTesting(rcpt.id);
        const r = await testRecipient(rcpt.id);
        setTesting(null);
        if (!r.ok) return toast.error(r.message);
        if (r.data.ok) toast.success(`Test ADT^A08 delivered to ${rcpt.name} (${r.data.detail ?? 'ok'})`);
        else toast.error(`Test delivery to ${rcpt.name} failed: ${r.data.error ?? 'unknown error'}`);
    }

    return (
        <section ref={ref} id="settings-care-notifications" className={settingsSecondaryCardClass} aria-labelledby="care-notifications-heading">
            <SettingsCardHeader
                title="Care Notifications"
                description="Admission, transfer and discharge (ADT) notifications to PCPs, post-acute providers and HIEs — CMS CoP 42 CFR 482.24(d)."
                actions={
                    <button type="button" className={settingsGhostButtonClass} onClick={() => setAdding((v) => !v)}>
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        {adding ? 'Close' : 'Add recipient'}
                    </button>
                }
            />
            <h2 id="care-notifications-heading" className="sr-only">Care Notifications</h2>
            <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
                {adding ? (
                    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-emr-border/80 bg-emr-hover/30 p-3 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2 lg:grid-cols-4">
                        <label className="sm:col-span-2"><span className={settingsFieldLabelClass}>Name *</span><input className={INPUT} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sunrise Skilled Nursing" /></label>
                        <label>
                            <span className={settingsFieldLabelClass}>Kind</span>
                            <select className={INPUT} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as RecipientKind }))}>
                                {(Object.keys(RECIPIENT_KIND_LABELS) as RecipientKind[]).map((k) => <option key={k} value={k}>{RECIPIENT_KIND_LABELS[k]}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className={settingsFieldLabelClass}>Transport</span>
                            <select className={INPUT} value={form.transport} onChange={(e) => setForm((f) => ({ ...f, transport: e.target.value as RecipientTransport }))}>
                                {(Object.keys(TRANSPORT_LABELS) as RecipientTransport[]).map((k) => <option key={k} value={k}>{TRANSPORT_LABELS[k]}</option>)}
                            </select>
                        </label>
                        <label className="sm:col-span-2 lg:col-span-3">
                            <span className={settingsFieldLabelClass}>Endpoint</span>
                            <input className={INPUT} value={form.endpoint ?? ''} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} placeholder={endpointHint[form.transport]} disabled={form.transport === 'stub'} />
                        </label>
                        <label>
                            <span className={settingsFieldLabelClass}>Authorization header</span>
                            <input className={INPUT} type="password" value={form.authHeaderSecret ?? ''} onChange={(e) => setForm((f) => ({ ...f, authHeaderSecret: e.target.value }))} placeholder="Bearer …" disabled={form.transport !== 'https_webhook'} />
                        </label>
                        <p className="text-[11px] text-emr-muted dark:text-gray-400 sm:col-span-2 lg:col-span-3">
                            PCP recipients are matched per patient (Register Patient → Primary care physician). Post-acute, HIE and other recipients receive every ADT event.
                        </p>
                        <div className="flex items-end">
                            <button type="submit" disabled={saving} className={settingsGhostButtonClass}>{saving ? 'Saving…' : 'Save recipient'}</button>
                        </div>
                    </form>
                ) : null}

                {loading ? (
                    <div className="h-4 w-40 animate-pulse rounded bg-emr-border/50 dark:bg-white/10" />
                ) : rows.length === 0 ? (
                    <p className="text-[13px] text-emr-muted dark:text-gray-400">No recipients configured. Until one is added, ADT events are logged with a stub recipient so the HL7 payload is still auditable.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-[13px]">
                            <thead className="text-[11px] uppercase tracking-wide text-emr-muted dark:text-gray-500">
                                <tr><th className="py-1.5 pr-3">Recipient</th><th className="py-1.5 pr-3">Kind</th><th className="py-1.5 pr-3">Transport</th><th className="py-1.5 pr-3">Endpoint</th><th className="py-1.5 pr-3">Enabled</th><th className="py-1.5" /></tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t border-emr-border/60 dark:border-white/10">
                                        <td className="py-2 pr-3 font-medium text-emr-text dark:text-gray-100">{r.name}</td>
                                        <td className="py-2 pr-3">{RECIPIENT_KIND_LABELS[r.kind]}</td>
                                        <td className="py-2 pr-3">{TRANSPORT_LABELS[r.transport]}</td>
                                        <td className="max-w-[16rem] truncate py-2 pr-3 font-mono text-[12px]" title={r.endpoint}>{r.endpoint || '—'}</td>
                                        <td className="py-2 pr-3">
                                            <label className="inline-flex items-center gap-1.5"><input type="checkbox" className="accent-primary" checked={r.enabled} onChange={() => void toggle(r)} /> {r.enabled ? 'On' : 'Off'}</label>
                                        </td>
                                        <td className="py-2 text-right">
                                            <div className="inline-flex gap-1">
                                                <button type="button" className={settingsGhostButtonClass} disabled={testing === r.id} onClick={() => void sendTest(r)} title="Send a test message"><Send className="h-3.5 w-3.5" aria-hidden />{testing === r.id ? 'Sending…' : 'Test'}</button>
                                                <button type="button" className={settingsGhostButtonClass} onClick={() => void remove(r)} title="Remove"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emr-muted dark:text-gray-500">Recent deliveries</p>
                    <AdtNotificationLogTable rows={log} onChanged={load} compact />
                </div>
            </div>
        </section>
    );
});
