import { forwardRef, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { SettingsCardHeader } from './SettingsCardHeader';
import { settingsFieldLabelClass, settingsGhostButtonClass, settingsSecondaryCardClass } from '../../../styles/settingsPageClasses';
import { downloadAuditEventsCsv, listAiRequests, listAuditEvents, type AiRequestRow } from '../../../services/auditEvents.service';
import { AUDIT_ACTIONS, type AuditEvent } from '../../../types/auditEvents';
import type { IRootState } from '../../../store';

const INPUT = 'h-9 w-full rounded-lg border border-emr-border/90 bg-white px-2.5 text-[13px] text-emr-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-100';

function formatAt(at: string): string {
    try {
        return new Date(at).toLocaleString();
    } catch {
        return at;
    }
}

interface AuditTrailCardProps {
    /** Pre-filters to one patient — set when navigated here from that patient's chart. */
    initialPatientId?: string;
}

export const AuditTrailCard = forwardRef<HTMLElement, AuditTrailCardProps>(function AuditTrailCard({ initialPatientId }, ref) {
    const role = useSelector((s: IRootState) => s.auth.role || s.auth.user?.role);
    const isAdmin = role === 'admin';
    const [tab, setTab] = useState<'events' | 'ai'>('events');
    const [patientId, setPatientId] = useState(initialPatientId ?? '');
    const [action, setAction] = useState('');
    const [resource, setResource] = useState('');
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [aiRows, setAiRows] = useState<AiRequestRow[]>([]);

    const load = useCallback(async () => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        setLoading(true);
        if (tab === 'events') {
            const res = await listAuditEvents({
                patientId: patientId.trim() || undefined,
                action: action || undefined,
                resource: resource.trim() || undefined,
            });
            setLoading(false);
            if (!res.ok) return toast.error(res.message);
            setEvents(res.data);
        } else {
            const res = await listAiRequests({ patientId: patientId.trim() || undefined });
            setLoading(false);
            if (!res.ok) return toast.error(res.message);
            setAiRows(res.data);
        }
    }, [tab, patientId, action, resource]);

    useEffect(() => {
        void load();
    }, [load]);

    async function exportCsv() {
        const res = await downloadAuditEventsCsv({
            patientId: patientId.trim() || undefined,
            action: action || undefined,
            resource: resource.trim() || undefined,
        });
        if (!res.ok) toast.error(res.message);
    }

    return (
        <section ref={ref} id="settings-audit-trail" className={settingsSecondaryCardClass} aria-labelledby="audit-trail-heading">
            <SettingsCardHeader
                title="Audit Trail"
                description="Who accessed or changed what, and when. Append-only — nothing here can be edited or deleted."
                actions={
                    tab === 'events' ? (
                        <button type="button" className={settingsGhostButtonClass} onClick={() => void exportCsv()}>
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Export CSV
                        </button>
                    ) : null
                }
            />
            <h2 id="audit-trail-heading" className="sr-only">
                Audit Trail
            </h2>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                {!isAdmin ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">The audit trail is visible to admin accounts only.</p>
                ) : (
                    <>
                <div className="flex gap-1 border-b border-emr-border/70 dark:border-white/10">
                    <button
                        type="button"
                        onClick={() => setTab('events')}
                        className={`px-3 py-2 text-[13px] font-medium ${tab === 'events' ? 'border-b-2 border-primary text-primary' : 'text-emr-muted dark:text-gray-400'}`}
                    >
                        Audit Events
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('ai')}
                        className={`px-3 py-2 text-[13px] font-medium ${tab === 'ai' ? 'border-b-2 border-primary text-primary' : 'text-emr-muted dark:text-gray-400'}`}
                    >
                        AI Requests
                    </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                    <label>
                        <span className={settingsFieldLabelClass}>Patient ID</span>
                        <input className={INPUT} value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Any patient" />
                    </label>
                    {tab === 'events' ? (
                        <>
                            <label>
                                <span className={settingsFieldLabelClass}>Action</span>
                                <select className={INPUT} value={action} onChange={(e) => setAction(e.target.value)}>
                                    <option value="">Any action</option>
                                    {AUDIT_ACTIONS.map((a) => (
                                        <option key={a} value={a}>
                                            {a}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span className={settingsFieldLabelClass}>Resource</span>
                                <input className={INPUT} value={resource} onChange={(e) => setResource(e.target.value)} placeholder="e.g. patients" />
                            </label>
                        </>
                    ) : null}
                </div>

                {loading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                ) : tab === 'events' ? (
                    events.length === 0 ? (
                        <p className="text-sm text-gray-500">No audit events match these filters.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-emr-border/80 dark:border-white/10">
                            <table className="min-w-full text-left text-[13px]">
                                <thead className="bg-emr-hover/40 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-white/[0.03]">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold">When</th>
                                        <th className="px-3 py-2 font-semibold">Actor</th>
                                        <th className="px-3 py-2 font-semibold">Action</th>
                                        <th className="px-3 py-2 font-semibold">Resource</th>
                                        <th className="px-3 py-2 font-semibold">Patient</th>
                                        <th className="px-3 py-2 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((e) => (
                                        <tr key={e.id} className="border-t border-emr-border/60 dark:border-white/[0.06]">
                                            <td className="px-3 py-2 whitespace-nowrap text-[12px] text-gray-600 dark:text-gray-300">{formatAt(e.at)}</td>
                                            <td className="px-3 py-2">
                                                {e.actorType}
                                                {e.actorRole ? ` · ${e.actorRole}` : ''}
                                            </td>
                                            <td className="px-3 py-2">{e.action}</td>
                                            <td className="px-3 py-2 font-mono text-[11px]">
                                                {e.resource ?? '—'}
                                                {e.resourceId ? ` / ${e.resourceId}` : ''}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-[11px]">{e.patientId ?? '—'}</td>
                                            <td className="px-3 py-2">{e.status ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : aiRows.length === 0 ? (
                    <p className="text-sm text-gray-500">No AI requests match these filters.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-emr-border/80 dark:border-white/10">
                        <table className="min-w-full text-left text-[13px]">
                            <thead className="bg-emr-hover/40 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-white/[0.03]">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">When</th>
                                    <th className="px-3 py-2 font-semibold">Endpoint</th>
                                    <th className="px-3 py-2 font-semibold">Model</th>
                                    <th className="px-3 py-2 font-semibold">Patient</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                    <th className="px-3 py-2 font-semibold">Latency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aiRows.map((r) => (
                                    <tr key={r.id} className="border-t border-emr-border/60 dark:border-white/[0.06]">
                                        <td className="px-3 py-2 whitespace-nowrap text-[12px] text-gray-600 dark:text-gray-300">{formatAt(r.createdAt)}</td>
                                        <td className="px-3 py-2 font-mono text-[11px]">{r.endpoint}</td>
                                        <td className="px-3 py-2 font-mono text-[11px]">{r.model}</td>
                                        <td className="px-3 py-2 font-mono text-[11px]">{r.patientId ?? '—'}</td>
                                        <td className="px-3 py-2">
                                            {r.status === 'error' ? <span className="text-red-700">{r.errorCode ?? 'error'}</span> : 'ok'}
                                        </td>
                                        <td className="px-3 py-2">{r.latencyMs != null ? `${r.latencyMs} ms` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                    </>
                )}
            </div>
        </section>
    );
});
