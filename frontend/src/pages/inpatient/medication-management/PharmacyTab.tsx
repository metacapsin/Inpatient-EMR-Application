import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Send, Printer, Ban, PenLine } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/httpError';
import { cn } from '../../../lib/utils';
import * as medApi from '../../../services/medicationManagement.service';
import type { DispenseMedicineLine, NewPrescriptionLine, Pharmacy, PrescriptionRow, PrescriptionStatus } from '../../../types/medicationManagement';
import { Input } from '@/components/ui/input';

interface PharmacyTabProps {
    patientId: string;
    encounterId?: string;
    defaultDispensedBy: string;
    canPrescribe: boolean;
}

type EditableRx = PrescriptionRow & {
    editLines: Array<{ medicineId: string; quantityDispensed: number; batchNumber: string; expiryDate: string; unitPrice: number }>;
};

function toEditable(rx: PrescriptionRow): EditableRx {
    return {
        ...rx,
        editLines: rx.medicines.map((m) => ({ medicineId: m.medicineId, quantityDispensed: m.quantityOrdered, batchNumber: m.batchNumber || '', expiryDate: m.expiryDate || '', unitPrice: m.unitPrice })),
    };
}

const STATUS_CLASS: Record<PrescriptionStatus, string> = {
    draft: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    signed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    transmitted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    printed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    dispensed: 'bg-emerald-600 text-white',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    error: 'bg-red-600 text-white',
};
const cell = 'h-9 w-full min-w-0 rounded border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800';
const SCHEDULES = ['', 'II', 'III', 'IV', 'V'] as const;
const emptyLine = (): NewPrescriptionLine => ({ name: '', strength: '', dose: '', route: 'PO', frequency: '', duration: '', instructions: '', quantity: 30, refills: 0, unitPrice: 0, controlledSchedule: null });

export function PharmacyTab({ patientId, encounterId, defaultDispensedBy, canPrescribe }: PharmacyTabProps) {
    const [prescriptions, setPrescriptions] = useState<EditableRx[]>([]);
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [filter, setFilter] = useState<'open' | 'all'>('open');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dispensedBy, setDispensedBy] = useState(defaultDispensedBy);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [lines, setLines] = useState<NewPrescriptionLine[]>([emptyLine()]);
    const [pharmacyId, setPharmacyId] = useState('');
    const [notes, setNotes] = useState('');
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const [list, ph] = await Promise.all([medApi.getPrescriptions(patientId, filter), medApi.listPharmacies().catch(() => [])]);
            setPrescriptions(list.map(toEditable));
            setPharmacies(ph);
            if (!pharmacyId) setPharmacyId(ph.find((p) => p.isDefault)?.id ?? '');
        } catch (e) {
            const msg = getApiErrorMessage(e, 'Failed to load prescriptions');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId, filter, pharmacyId]);

    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        setDispensedBy(defaultDispensedBy);
    }, [defaultDispensedBy]);

    function updateLine(prescriptionId: string, medicineId: string, patch: Partial<{ quantityDispensed: number; batchNumber: string; expiryDate: string }>) {
        setPrescriptions((prev) => prev.map((rx) => (rx.prescriptionId !== prescriptionId ? rx : { ...rx, editLines: rx.editLines.map((l) => (l.medicineId === medicineId ? { ...l, ...patch } : l)) })));
    }

    const totalsByRx = useMemo(() => {
        const map = new Map<string, number>();
        for (const rx of prescriptions) {
            let t = 0;
            for (const l of rx.editLines) if (l.quantityDispensed > 0) t += l.quantityDispensed * l.unitPrice;
            map.set(rx.prescriptionId, Math.round(t * 100) / 100);
        }
        return map;
    }, [prescriptions]);

    async function handleDispense(rx: EditableRx) {
        if (!dispensedBy.trim()) return toast.error('Dispensed by is required');
        for (const l of rx.editLines) {
            if (l.quantityDispensed < 0) return toast.error('Quantity cannot be negative');
            if (l.quantityDispensed > 0 && (!l.batchNumber.trim() || !l.expiryDate.trim())) return toast.error('Batch number and expiry date are required for dispensed items');
        }
        const medicines: DispenseMedicineLine[] = rx.editLines.filter((l) => l.quantityDispensed > 0).map((l) => ({ medicineId: l.medicineId, quantityDispensed: l.quantityDispensed, batchNumber: l.batchNumber.trim(), expiryDate: l.expiryDate.trim(), unitPrice: l.unitPrice }));
        if (medicines.length === 0) return toast.error('Enter quantity to dispense for at least one line');
        const totalCost = Math.round(medicines.reduce((s, m) => s + m.quantityDispensed * m.unitPrice, 0) * 100) / 100;
        setBusyId(rx.prescriptionId);
        try {
            await medApi.postDispense({ prescriptionId: rx.prescriptionId, medicines, dispensedBy: dispensedBy.trim(), totalCost });
            toast.success('Dispense recorded');
            await load();
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'Dispense failed'));
        } finally {
            setBusyId(null);
        }
    }

    async function act(rx: PrescriptionRow, action: 'sign' | 'transmit' | 'print' | 'cancel') {
        setBusyId(rx.prescriptionId);
        const r =
            action === 'sign' ? await medApi.signPrescription(rx.prescriptionId)
            : action === 'transmit' ? await medApi.transmitPrescription(rx.prescriptionId, rx.pharmacyId ?? pharmacyId ?? undefined)
            : action === 'print' ? await medApi.printPrescription(rx.prescriptionId)
            : await medApi.cancelPrescription(rx.prescriptionId);
        setBusyId(null);
        if (!r.ok) return toast.error(r.message);
        toast.success(action === 'sign' ? 'Prescription signed' : action === 'transmit' ? `Transmitted to ${r.data.pharmacyName || 'pharmacy'} (ref ${r.data.transmissionRef})` : action === 'print' ? 'Marked as printed' : 'Prescription cancelled');
        await load();
    }

    async function create() {
        const clean = lines.filter((l) => l.name.trim());
        if (!clean.length) return toast.error('Add at least one medication');
        for (const l of clean) if (!l.quantity || l.quantity < 1) return toast.error(`${l.name}: quantity must be at least 1`);
        setCreating(true);
        const r = await medApi.createPrescription({ patientId, encounterId, pharmacyId: pharmacyId || undefined, notes: notes.trim() || undefined, medicines: clean.map((l) => ({ ...l, name: l.name.trim(), controlledSchedule: l.controlledSchedule || null })) });
        setCreating(false);
        if (!r.ok) return toast.error(r.message);
        toast.success('Prescription saved as draft — sign it to continue');
        setLines([emptyLine()]);
        setNotes('');
        setShowForm(false);
        await load();
    }

    const setL = (i: number, patch: Partial<NewPrescriptionLine>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

    return (
        <div className="space-y-4">
            {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">{error}</div>}

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px]">
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Dispensed by</label>
                        <input className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800" value={dispensedBy} onChange={(e) => setDispensedBy(e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                        {(['open', 'all'] as const).map((f) => (
                            <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded px-3 py-2 text-sm', filter === f ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800')}>{f === 'open' ? 'Open' : 'All statuses'}</button>
                        ))}
                    </div>
                </div>
                {canPrescribe ? (
                    <button type="button" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white" onClick={() => setShowForm((v) => !v)}>
                        <Plus className="h-4 w-4" aria-hidden /> {showForm ? 'Close' : 'New prescription'}
                    </button>
                ) : null}
            </div>

            {showForm ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New prescription (e-Rx)</h3>
                    <p className="text-xs text-gray-500">Saved as a draft. Signing records your NPI/DEA; transmit sends it to the selected pharmacy. Controlled substances cannot be signed electronically until EPCS is enabled.</p>
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-[980px] w-full text-left text-sm">
                            <thead className="bg-white/60 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60">
                                <tr><th className="px-2 py-1">Medication *</th><th className="px-2 py-1">Strength / dose</th><th className="px-2 py-1">Route</th><th className="px-2 py-1">Frequency</th><th className="px-2 py-1">Duration</th><th className="px-2 py-1">Qty *</th><th className="px-2 py-1">Refills</th><th className="px-2 py-1">Sched.</th><th className="px-2 py-1">Sig / instructions</th><th /></tr>
                            </thead>
                            <tbody>
                                {lines.map((l, i) => (
                                    <tr key={i}>
                                        <td className="px-2 py-1"><input className={cell} value={l.name} onChange={(e) => setL(i, { name: e.target.value })} placeholder="Amoxicillin" /></td>
                                        <td className="px-2 py-1"><input className={cell} value={l.dose ?? ''} onChange={(e) => setL(i, { dose: e.target.value, strength: e.target.value })} placeholder="500 mg" /></td>
                                        <td className="px-2 py-1"><input className={cell} value={l.route ?? ''} onChange={(e) => setL(i, { route: e.target.value })} /></td>
                                        <td className="px-2 py-1"><input className={cell} value={l.frequency ?? ''} onChange={(e) => setL(i, { frequency: e.target.value })} placeholder="TID" /></td>
                                        <td className="px-2 py-1"><input className={cell} value={l.duration ?? ''} onChange={(e) => setL(i, { duration: e.target.value })} placeholder="7 days" /></td>
                                        <td className="px-2 py-1"><input type="number" min={1} className={cn(cell, 'w-20')} value={l.quantity} onChange={(e) => setL(i, { quantity: Number(e.target.value) || 0 })} /></td>
                                        <td className="px-2 py-1"><input type="number" min={0} max={99} className={cn(cell, 'w-16')} value={l.refills} onChange={(e) => setL(i, { refills: Number(e.target.value) || 0 })} /></td>
                                        <td className="px-2 py-1">
                                            <select className={cn(cell, 'w-20')} value={l.controlledSchedule ?? ''} onChange={(e) => setL(i, { controlledSchedule: (e.target.value || null) as NewPrescriptionLine['controlledSchedule'] })} title="Controlled substance schedule (EPCS not enabled — signing is blocked)">
                                                {SCHEDULES.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-2 py-1"><input className={cell} value={l.instructions ?? ''} onChange={(e) => setL(i, { instructions: e.target.value })} placeholder="Take with food" /></td>
                                        <td className="px-2 py-1">{lines.length > 1 ? <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" aria-hidden /></button> : null}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <button type="button" className="inline-flex h-10 items-center gap-1 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-600" onClick={() => setLines((p) => [...p, emptyLine()])}><Plus className="h-4 w-4" aria-hidden /> Add line</button>
                        <div>
                            <select className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800" value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
                                <option value="">Pharmacy (choose before transmitting)</option>
                                {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
                            </select>
                            {pharmacies.length === 0 ? <p className="mt-1 text-[11px] text-amber-700">No pharmacies yet — add one under Settings → Pharmacies.</p> : null}
                        </div>
                        <input className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to pharmacy (optional)" />
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button type="button" disabled={creating} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => void create()}>{creating ? 'Saving…' : 'Save draft'}</button>
                    </div>
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center gap-2 text-gray-600"><Loader2 className="h-6 w-6 animate-spin" /> Loading prescriptions…</div>
            ) : prescriptions.length === 0 ? (
                <p className="text-sm text-gray-500">No {filter === 'open' ? 'open ' : ''}prescriptions for this patient.</p>
            ) : (
                prescriptions.map((rx) => {
                    const status = rx.status ?? 'draft';
                    const controlled = rx.controlledSchedule || rx.medicines.find((m) => m.controlledSchedule)?.controlledSchedule;
                    const dispensable = !['dispensed', 'cancelled'].includes(status);
                    return (
                        <div key={rx.prescriptionId} className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Prescription {rx.prescriptionId.slice(-8)}</h3>
                                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_CLASS[status])}>{status}</span>
                                        {controlled ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200" title="EPCS not enabled">Schedule {controlled} · EPCS required</span> : null}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {rx.prescriberName || '—'}{rx.prescriberNpi ? ` · NPI ${rx.prescriberNpi}` : ''}{rx.prescriberDea ? ` · DEA ${rx.prescriberDea}` : ''}
                                        {rx.pharmacyName ? ` · ${rx.pharmacyName}` : ''}{rx.transmissionRef ? ` · ref ${rx.transmissionRef}` : ''}
                                    </p>
                                    {rx.errorMessage ? <p className="text-xs text-red-700">{rx.errorMessage}</p> : null}
                                </div>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Total: ${(totalsByRx.get(rx.prescriptionId) ?? 0).toFixed(2)}</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800/80">
                                        <tr><th className="px-2 py-2">Medicine</th><th className="px-2 py-2">Sig</th><th className="px-2 py-2">Qty / refills</th><th className="px-2 py-2">Qty dispensed</th><th className="px-2 py-2">Batch</th><th className="px-2 py-2">Expiry</th><th className="px-2 py-2">Unit $</th></tr>
                                    </thead>
                                    <tbody>
                                        {rx.medicines.map((m) => {
                                            const line = rx.editLines.find((l) => l.medicineId === m.medicineId)!;
                                            return (
                                                <tr key={m.medicineId} className="border-t border-gray-100 dark:border-gray-700">
                                                    <td className="px-2 py-2"><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">{m.strength || m.dose}</div></td>
                                                    <td className="px-2 py-2 text-xs text-gray-600 dark:text-gray-400">{[m.dose, m.route, m.frequency, m.duration ? `× ${m.duration}` : ''].filter(Boolean).join(' ')}{m.instructions ? ` — ${m.instructions}` : ''}</td>
                                                    <td className="px-2 py-2">{m.quantity ?? m.quantityOrdered}{m.refills != null ? ` / ${m.refills}` : ''}</td>
                                                    <td className="px-2 py-2"><input type="number" min={0} disabled={!dispensable} className="h-9 w-20 rounded border border-gray-300 px-1 dark:border-gray-600 dark:bg-gray-800" value={line.quantityDispensed} onChange={(e) => updateLine(rx.prescriptionId, m.medicineId, { quantityDispensed: Number(e.target.value) || 0 })} /></td>
                                                    <td className="px-2 py-2"><input disabled={!dispensable} className="h-9 w-28 rounded border border-gray-300 px-1 text-xs dark:border-gray-600 dark:bg-gray-800" value={line.batchNumber} placeholder="Batch #" onChange={(e) => updateLine(rx.prescriptionId, m.medicineId, { batchNumber: e.target.value })} /></td>
                                                    <td className="px-2 py-2"><Input type="date" disabled={!dispensable} className="min-w-[7.5rem] max-w-[9.5rem]" value={line.expiryDate} onChange={(e) => updateLine(rx.prescriptionId, m.medicineId, { expiryDate: e.target.value })} /></td>
                                                    <td className="px-2 py-2">${m.unitPrice.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {rx.statusHistory?.length ? (
                                <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                                    {rx.statusHistory.map((h, i) => <li key={i}><span className="font-semibold capitalize">{h.status}</span> {new Date(h.at).toLocaleString()}{h.byName ? ` · ${h.byName}` : ''}</li>)}
                                </ol>
                            ) : null}
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                                {canPrescribe && status === 'draft' ? <button type="button" disabled={busyId === rx.prescriptionId} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" onClick={() => void act(rx, 'sign')}><PenLine className="h-4 w-4" aria-hidden /> Sign</button> : null}
                                {status === 'signed' ? <button type="button" disabled={busyId === rx.prescriptionId || (!rx.pharmacyId && !pharmacyId)} title={!rx.pharmacyId && !pharmacyId ? 'Choose a pharmacy first' : 'Send to pharmacy'} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600" onClick={() => void act(rx, 'transmit')}><Send className="h-4 w-4" aria-hidden /> Transmit</button> : null}
                                {status === 'signed' || status === 'error' ? <button type="button" disabled={busyId === rx.prescriptionId} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" onClick={() => void act(rx, 'print')}><Printer className="h-4 w-4" aria-hidden /> Print</button> : null}
                                {dispensable ? <button type="button" disabled={busyId === rx.prescriptionId} className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-800" onClick={() => void act(rx, 'cancel')}><Ban className="h-4 w-4" aria-hidden /> Cancel</button> : null}
                                {dispensable ? <button type="button" disabled={busyId === rx.prescriptionId} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => void handleDispense(rx)}>{busyId === rx.prescriptionId ? 'Working…' : 'Dispense'}</button> : null}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
