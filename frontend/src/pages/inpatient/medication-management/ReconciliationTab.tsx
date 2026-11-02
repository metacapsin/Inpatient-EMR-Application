import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Home, Hospital, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
    addHomeMedication,
    completeReconciliation,
    getReconciliation,
    listHomeMedications,
    listReconciliations,
    removeHomeMedication,
    saveReconciliation,
    type HomeMedication,
    type MedicationReconciliation,
    type ReconciliationAction,
    type ReconciliationLine,
    type ReconciliationType,
} from '../../../services/medReconciliation.service';

interface Props {
    patientId: string;
    encounterId?: string;
    canEdit: boolean;
}

const cell = 'h-9 w-full min-w-0 rounded border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800';
const TYPES: { id: ReconciliationType; label: string; hint: string }[] = [
    { id: 'admission', label: 'Admission', hint: 'Home medications → inpatient orders' },
    { id: 'transfer', label: 'Transfer', hint: 'Review active inpatient medications at level-of-care change' },
    { id: 'discharge', label: 'Discharge', hint: 'Inpatient + home medications → discharge list' },
];
const ACTIONS: { id: ReconciliationAction; label: string; cls: string }[] = [
    { id: 'continue', label: 'Continue', cls: 'bg-emerald-600 text-white' },
    { id: 'modify', label: 'Modify', cls: 'bg-amber-500 text-white' },
    { id: 'stop', label: 'Stop', cls: 'bg-red-600 text-white' },
];

const emptyLine = (): ReconciliationLine => ({ id: `new-${Date.now()}`, name: '', dose: '', route: '', frequency: '', duration: '', instructions: '', action: 'new', reason: '', originalMedicationId: null, source: null });

/** Two-column compare: the patient's home medications on the left, the reconciliation worksheet on the right. */
export function ReconciliationTab({ patientId, encounterId, canEdit }: Props) {
    const eid = encounterId?.trim() ?? '';
    const [type, setType] = useState<ReconciliationType>('admission');
    const [home, setHome] = useState<HomeMedication[]>([]);
    const [overview, setOverview] = useState<MedicationReconciliation[]>([]);
    const [rec, setRec] = useState<MedicationReconciliation | null>(null);
    const [lines, setLines] = useState<ReconciliationLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [newHome, setNewHome] = useState({ name: '', dose: '', route: '', frequency: '', reportedBy: 'patient' });

    const loadHome = useCallback(async () => {
        if (!patientId) return;
        try {
            setHome(await listHomeMedications(patientId));
        } catch {
            toast.error('Could not load home medications');
        }
    }, [patientId]);

    const loadRec = useCallback(async () => {
        if (!eid) return;
        setLoading(true);
        const [r, all] = await Promise.all([getReconciliation(eid, type), listReconciliations(eid).catch(() => [])]);
        setLoading(false);
        setOverview(all);
        if (!r.ok) {
            toast.error(r.message);
            setRec(null);
            return;
        }
        setRec(r.data);
        setLines(r.data.lines);
    }, [eid, type]);

    useEffect(() => {
        void loadHome();
    }, [loadHome]);
    useEffect(() => {
        void loadRec();
    }, [loadRec]);

    const locked = !canEdit || !rec || rec.status === 'completed';
    const statusOf = (t: ReconciliationType) => overview.find((r) => r.type === t)?.status;

    const missing = useMemo(() => lines.filter((l) => !l.action).length, [lines]);

    function setLine(id: string, patch: Partial<ReconciliationLine>) {
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    }

    async function addHome() {
        if (!newHome.name.trim()) return toast.error('Medication name is required');
        try {
            await addHomeMedication(patientId, { name: newHome.name.trim(), dose: newHome.dose.trim(), route: newHome.route.trim(), frequency: newHome.frequency.trim(), reportedBy: newHome.reportedBy });
            setNewHome({ name: '', dose: '', route: '', frequency: '', reportedBy: 'patient' });
            toast.success('Home medication recorded');
            await loadHome();
        } catch {
            toast.error('Could not add home medication');
        }
    }

    async function dropHome(m: HomeMedication) {
        try {
            await removeHomeMedication(patientId, m.id);
            await loadHome();
        } catch {
            toast.error('Could not remove home medication');
        }
    }

    async function save() {
        if (!eid) return;
        setBusy(true);
        const r = await saveReconciliation(eid, type, lines);
        setBusy(false);
        if (!r.ok) return toast.error(r.message);
        setRec(r.data);
        setLines(r.data.lines);
        toast.success('Draft saved');
    }

    async function complete() {
        if (!eid) return;
        if (missing) return toast.error(`Choose Continue / Modify / Stop for every medication (${missing} left)`);
        setBusy(true);
        const r = await completeReconciliation(eid, type, lines);
        setBusy(false);
        if (!r.ok) return toast.error(r.message);
        setRec(r.data);
        setLines(r.data.lines);
        toast.success(type === 'admission' ? 'Admission reconciliation complete — inpatient medications created' : type === 'discharge' ? 'Discharge reconciliation complete — discharge medication list written' : 'Transfer reconciliation complete');
        await Promise.all([loadRec(), loadHome()]);
    }

    return (
        <div className="space-y-4">
            {!eid ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100">
                    Choose an <strong>active encounter</strong> above to reconcile medications. Home medications can be recorded without one.
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-12">
                {/* Home medications (source list) */}
                <section className="rounded-md border border-gray-200 p-3 dark:border-gray-700 lg:col-span-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><Home className="h-4 w-4 text-primary" aria-hidden /> Home medications</h3>
                    <p className="mt-0.5 text-[11px] text-gray-500">What the patient takes at home, as reported by the patient, family or pharmacy.</p>
                    <ul className="mt-3 space-y-2">
                        {home.length === 0 ? <li className="text-sm text-gray-500">None recorded.</li> : null}
                        {home.map((m) => (
                            <li key={m.id} className="flex items-start justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900/40">
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{m.name}</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">{[m.dose, m.route, m.frequency].filter(Boolean).join(' · ') || '—'}{m.reportedBy ? ` · reported by ${m.reportedBy}` : ''}</div>
                                </div>
                                {canEdit ? <button type="button" className="text-gray-400 hover:text-red-600" title="Remove" onClick={() => void dropHome(m)}><Trash2 className="h-4 w-4" aria-hidden /></button> : null}
                            </li>
                        ))}
                    </ul>
                    {canEdit ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <input className={cn(cell, 'col-span-2')} placeholder="Medication name" value={newHome.name} onChange={(e) => setNewHome((v) => ({ ...v, name: e.target.value }))} />
                            <input className={cell} placeholder="Dose" value={newHome.dose} onChange={(e) => setNewHome((v) => ({ ...v, dose: e.target.value }))} />
                            <input className={cell} placeholder="Route" value={newHome.route} onChange={(e) => setNewHome((v) => ({ ...v, route: e.target.value }))} />
                            <input className={cell} placeholder="Frequency" value={newHome.frequency} onChange={(e) => setNewHome((v) => ({ ...v, frequency: e.target.value }))} />
                            <select className={cell} value={newHome.reportedBy} onChange={(e) => setNewHome((v) => ({ ...v, reportedBy: e.target.value }))}>
                                {['patient', 'family', 'pharmacy', 'PDMP', 'other'].map((s) => <option key={s} value={s}>Reported by {s}</option>)}
                            </select>
                            <button type="button" className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white" onClick={() => void addHome()}><Plus className="h-4 w-4" aria-hidden /> Add home medication</button>
                        </div>
                    ) : null}
                </section>

                {/* Reconciliation worksheet */}
                <section className="rounded-md border border-gray-200 p-3 dark:border-gray-700 lg:col-span-8">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><Hospital className="h-4 w-4 text-primary" aria-hidden /> Reconciliation</h3>
                        <div className="flex gap-1">
                            {TYPES.map((t) => {
                                const st = statusOf(t.id);
                                return (
                                    <button key={t.id} type="button" title={t.hint} onClick={() => setType(t.id)} className={cn('rounded px-3 py-1 text-sm', type === t.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800')}>
                                        {t.label}{st === 'completed' ? ' ✓' : ''}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500">{TYPES.find((t) => t.id === type)?.hint}</p>

                    {!eid ? null : loading ? (
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                    ) : !rec ? null : (
                        <>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                <span className={cn('rounded-full px-2 py-0.5 font-semibold', rec.status === 'completed' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200')}>
                                    {rec.status === 'completed' ? `Completed ${rec.completedAt ? new Date(rec.completedAt).toLocaleString() : ''}${rec.completedByName ? ` by ${rec.completedByName}` : ''}` : 'Draft'}
                                </span>
                                {rec.status !== 'completed' && missing ? <span className="text-amber-700 dark:text-amber-300">{missing} medication(s) still need an action</span> : null}
                            </div>
                            <div className="mt-3 overflow-x-auto">
                                <table className="min-w-[760px] w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/80">
                                        <tr>
                                            <th className="px-2 py-2">Source</th>
                                            <th className="px-2 py-2">Medication</th>
                                            <th className="px-2 py-2">Dose</th>
                                            <th className="px-2 py-2">Route</th>
                                            <th className="px-2 py-2">Frequency</th>
                                            {type === 'discharge' ? <th className="px-2 py-2">Duration</th> : null}
                                            <th className="px-2 py-2">Action</th>
                                            <th className="px-2 py-2">Reason / instructions</th>
                                            <th className="px-2 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.length === 0 ? <tr><td colSpan={9} className="px-2 py-4 text-center text-gray-500">No medications to reconcile. Add a new one below if needed.</td></tr> : null}
                                        {lines.map((l) => {
                                            const editable = !locked && (l.action === 'modify' || l.action === 'new');
                                            return (
                                                <tr key={l.id} className={cn('border-t border-gray-100 dark:border-gray-700', l.action === 'stop' && 'opacity-60')}>
                                                    <td className="px-2 py-1.5 text-xs text-gray-500">{l.source === 'home' ? 'Home' : l.source === 'inpatient' ? 'Inpatient' : 'New'}</td>
                                                    <td className="px-2 py-1.5"><input className={cell} disabled={!editable} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} /></td>
                                                    <td className="px-2 py-1.5"><input className={cell} disabled={!editable} value={l.dose} onChange={(e) => setLine(l.id, { dose: e.target.value })} /></td>
                                                    <td className="px-2 py-1.5"><input className={cell} disabled={!editable} value={l.route ?? ''} onChange={(e) => setLine(l.id, { route: e.target.value })} /></td>
                                                    <td className="px-2 py-1.5"><input className={cell} disabled={!editable} value={l.frequency} onChange={(e) => setLine(l.id, { frequency: e.target.value })} /></td>
                                                    {type === 'discharge' ? <td className="px-2 py-1.5"><input className={cell} disabled={locked || l.action === 'stop'} value={l.duration ?? ''} onChange={(e) => setLine(l.id, { duration: e.target.value })} placeholder="30 days" /></td> : null}
                                                    <td className="px-2 py-1.5">
                                                        {l.action === 'new' ? (
                                                            <span className="rounded px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white">New</span>
                                                        ) : (
                                                            <div className="flex gap-1">
                                                                {ACTIONS.map((a) => (
                                                                    <button key={a.id} type="button" disabled={locked} onClick={() => setLine(l.id, { action: a.id })} className={cn('rounded px-2 py-0.5 text-xs font-semibold', l.action === a.id ? a.cls : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300')}>
                                                                        {a.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-1.5"><input className={cell} disabled={locked} value={l.reason} onChange={(e) => setLine(l.id, { reason: e.target.value })} placeholder={l.action === 'stop' ? 'Why stopped' : 'Notes'} /></td>
                                                    <td className="px-2 py-1.5">{!locked && l.action === 'new' ? <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => setLines((p) => p.filter((x) => x.id !== l.id))}><Trash2 className="h-4 w-4" aria-hidden /></button> : null}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {!locked ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" onClick={() => setLines((p) => [...p, emptyLine()])}><Plus className="h-4 w-4" aria-hidden /> Add new medication</button>
                                    <button type="button" disabled={busy} className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" onClick={() => void save()}>Save draft</button>
                                    <button type="button" disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => void complete()}>
                                        <CheckCircle2 className="h-4 w-4" aria-hidden /> Complete {TYPES.find((t) => t.id === type)?.label.toLowerCase()} reconciliation
                                    </button>
                                </div>
                            ) : rec.status === 'completed' && type === 'transfer' && canEdit ? (
                                <button type="button" className="mt-3 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" onClick={() => { setRec({ ...rec, status: 'draft' }); }}>Start another transfer reconciliation</button>
                            ) : null}
                            {!canEdit ? <p className="mt-2 text-sm text-gray-500">Your role cannot edit medication reconciliation.</p> : null}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
