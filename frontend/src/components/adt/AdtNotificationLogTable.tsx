import { useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, FileText } from 'lucide-react';
import { AppModal } from '../shared/AppModal';
import { ADT_EVENT_LABELS, deliverNow, TRANSPORT_LABELS, type AdtNotificationLogRow } from '../../services/adtNotifications.service';

type Props = { rows: AdtNotificationLogRow[]; onChanged?: () => void | Promise<void>; compact?: boolean };

const statusClass: Record<AdtNotificationLogRow['status'], string> = {
    sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    queued: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
};

/** Delivery log for CMS CoP ADT notifications; failed rows can be retried in place. */
export function AdtNotificationLogTable({ rows, onChanged, compact }: Props) {
    const [open, setOpen] = useState<AdtNotificationLogRow | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    async function retry(row: AdtNotificationLogRow) {
        setBusy(row.id);
        const r = await deliverNow(row.id);
        setBusy(null);
        if (!r.ok) return toast.error(r.message);
        if (r.data.status === 'sent') toast.success(`Delivered to ${r.data.recipientName}`);
        else toast.error(`Delivery failed again: ${r.data.lastError ?? 'unknown error'}`);
        await onChanged?.();
    }

    if (rows.length === 0) return <p className="text-[13px] text-gray-500 dark:text-gray-400">No ADT notifications yet.</p>;

    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px]">
                    <thead className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">
                        <tr>
                            <th className="py-1.5 pr-3">When</th>
                            <th className="py-1.5 pr-3">Event</th>
                            {!compact ? null : <th className="py-1.5 pr-3">Patient</th>}
                            <th className="py-1.5 pr-3">Recipient</th>
                            <th className="py-1.5 pr-3">Transport</th>
                            <th className="py-1.5 pr-3">Status</th>
                            <th className="py-1.5" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t border-gray-200/70 dark:border-white/10">
                                <td className="whitespace-nowrap py-2 pr-3 text-gray-600 dark:text-gray-400">{new Date(r.createdAt).toLocaleString()}</td>
                                <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">{r.eventType} · {ADT_EVENT_LABELS[r.eventType]}</td>
                                {!compact ? null : <td className="py-2 pr-3">{r.patientName ?? '—'}</td>}
                                <td className="py-2 pr-3">{r.recipientName || '—'}</td>
                                <td className="py-2 pr-3">{TRANSPORT_LABELS[r.transport] ?? r.transport}</td>
                                <td className="py-2 pr-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass[r.status]}`} title={r.lastError ?? undefined}>
                                        {r.status}{r.attempts > 1 ? ` ×${r.attempts}` : ''}
                                    </span>
                                    {r.lastError ? <p className="mt-0.5 max-w-[18rem] truncate text-[11px] text-red-700 dark:text-red-300" title={r.lastError}>{r.lastError}</p> : null}
                                </td>
                                <td className="py-2 text-right">
                                    <div className="inline-flex gap-1">
                                        <button type="button" className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[12px] hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5" onClick={() => setOpen(r)} title="View HL7 message">
                                            <FileText className="h-3.5 w-3.5" aria-hidden /> HL7
                                        </button>
                                        {r.status !== 'sent' ? (
                                            <button type="button" disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[12px] hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5" onClick={() => void retry(r)}>
                                                <RefreshCw className={`h-3.5 w-3.5 ${busy === r.id ? 'animate-spin' : ''}`} aria-hidden /> Retry
                                            </button>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <AppModal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `ADT^${open.eventType} — ${open.recipientName || 'stub'}` : ''} description="HL7 v2.5 message as sent" size="lg">
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-900 p-3 font-mono text-[12px] leading-relaxed text-gray-100">{open?.message.replace(/\r/g, '\n')}</pre>
            </AppModal>
        </>
    );
}
