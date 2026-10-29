import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pill, Syringe, TestTubes, ScanLine } from 'lucide-react';
import { placeOrder } from '../../../services/cpoeOrders.service';
import type { CpoeOrderRow, CpoeOrderType } from '../../../types/cpoeOrders';

const LABEL_CLASS = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const INPUT_CLASS =
    'w-full rounded-md border border-gray-200/80 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/30 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100';

const TYPE_TABS: Array<{ type: CpoeOrderType; label: string; icon: typeof Pill }> = [
    { type: 'medication', label: 'Medication', icon: Pill },
    { type: 'prn_stat', label: 'PRN / STAT', icon: Syringe },
    { type: 'lab', label: 'Lab', icon: TestTubes },
    { type: 'radiology', label: 'Radiology', icon: ScanLine },
];

type NewOrderFormProps = {
    patientId: string;
    encounterId: string;
    onPlaced: (order: CpoeOrderRow) => void;
};

export function NewOrderForm({ patientId, encounterId, onPlaced }: NewOrderFormProps) {
    const [type, setType] = useState<CpoeOrderType>('medication');
    const [submitting, setSubmitting] = useState(false);

    const [medName, setMedName] = useState('');
    const [medDose, setMedDose] = useState('');
    const [medRoute, setMedRoute] = useState('');
    const [medFrequency, setMedFrequency] = useState('');
    const [medScheduledFor, setMedScheduledFor] = useState('');

    const [prnName, setPrnName] = useState('');
    const [prnKind, setPrnKind] = useState<'PRN' | 'STAT'>('PRN');
    const [prnIndication, setPrnIndication] = useState('');
    const [prnGivenBy, setPrnGivenBy] = useState('');

    const [labTests, setLabTests] = useState('');
    const [labPriority, setLabPriority] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');

    const [radModality, setRadModality] = useState('');
    const [radBodyRegion, setRadBodyRegion] = useState('');
    const [radIndication, setRadIndication] = useState('');
    const [radPriority, setRadPriority] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');

    function resetForm() {
        setMedName(''); setMedDose(''); setMedRoute(''); setMedFrequency(''); setMedScheduledFor('');
        setPrnName(''); setPrnIndication(''); setPrnGivenBy('');
        setLabTests('');
        setRadModality(''); setRadBodyRegion(''); setRadIndication('');
    }

    async function handleSubmit() {
        if (!encounterId.trim()) {
            toast.error('No active encounter for this patient — admit the patient first');
            return;
        }
        let body;
        if (type === 'medication') {
            if (!medName.trim()) return toast.error('Medication name is required');
            body = {
                orderType: 'medication' as const,
                patientId,
                encounterId,
                name: medName.trim(),
                dose: medDose.trim() || undefined,
                route: medRoute.trim() || undefined,
                frequency: medFrequency.trim() || undefined,
                nextScheduledTime: medScheduledFor ? new Date(medScheduledFor).toISOString() : undefined,
            };
        } else if (type === 'prn_stat') {
            if (!prnName.trim() || !prnIndication.trim() || !prnGivenBy.trim()) return toast.error('Medication, indication and given-by are required');
            body = { orderType: 'prn_stat' as const, patientId, encounterId, medicationName: prnName.trim(), type: prnKind, indication: prnIndication.trim(), orderedTime: new Date().toISOString(), givenBy: prnGivenBy.trim() };
        } else if (type === 'lab') {
            const tests = labTests.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name }));
            if (!tests.length) return toast.error('At least one lab test is required');
            body = { orderType: 'lab' as const, patientId, encounterId, labTests: tests, priority: labPriority };
        } else {
            if (!radModality.trim() || !radBodyRegion.trim() || !radIndication.trim()) return toast.error('Modality, body region and clinical indication are required');
            body = { orderType: 'radiology' as const, patientId, encounterId, modality: radModality.trim(), bodyRegion: radBodyRegion.trim(), clinicalIndication: radIndication.trim(), priority: radPriority };
        }

        setSubmitting(true);
        try {
            const order = await placeOrder(body);
            toast.success('Order placed');
            resetForm();
            onPlaced(order);
        } catch (err) {
            const e = err as { response?: { data?: { message?: string } } };
            toast.error(e?.response?.data?.message || 'Could not place order');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="rounded-lg border border-gray-200/70 bg-white p-3 dark:border-white/[0.08] dark:bg-[#141210]">
            <div className="mb-3 flex flex-wrap gap-1.5">
                {TYPE_TABS.map(({ type: t, label, icon: Icon }) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                            type === t
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-gray-200/80 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-300 dark:hover:bg-white/[0.04]'
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {type === 'medication' && (
                    <>
                        <div className="sm:col-span-2">
                            <label className={LABEL_CLASS}>Medication *</label>
                            <input className={INPUT_CLASS} value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Lisinopril" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Dose</label>
                            <input className={INPUT_CLASS} value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder="10 mg" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Route</label>
                            <input className={INPUT_CLASS} value={medRoute} onChange={(e) => setMedRoute(e.target.value)} placeholder="PO" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Frequency</label>
                            <input className={INPUT_CLASS} value={medFrequency} onChange={(e) => setMedFrequency(e.target.value)} placeholder="Daily" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Scheduled time</label>
                            <input type="datetime-local" className={INPUT_CLASS} value={medScheduledFor} onChange={(e) => setMedScheduledFor(e.target.value)} />
                        </div>
                    </>
                )}

                {type === 'prn_stat' && (
                    <>
                        <div className="sm:col-span-2">
                            <label className={LABEL_CLASS}>Medication *</label>
                            <input className={INPUT_CLASS} value={prnName} onChange={(e) => setPrnName(e.target.value)} placeholder="Morphine" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Type *</label>
                            <select className={INPUT_CLASS} value={prnKind} onChange={(e) => setPrnKind(e.target.value as 'PRN' | 'STAT')}>
                                <option value="PRN">PRN</option>
                                <option value="STAT">STAT</option>
                            </select>
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Given by *</label>
                            <input className={INPUT_CLASS} value={prnGivenBy} onChange={(e) => setPrnGivenBy(e.target.value)} placeholder="RN Priya" />
                        </div>
                        <div className="sm:col-span-4">
                            <label className={LABEL_CLASS}>Indication *</label>
                            <input className={INPUT_CLASS} value={prnIndication} onChange={(e) => setPrnIndication(e.target.value)} placeholder="Severe pain" />
                        </div>
                    </>
                )}

                {type === 'lab' && (
                    <>
                        <div className="sm:col-span-3">
                            <label className={LABEL_CLASS}>Lab tests * (comma-separated)</label>
                            <input className={INPUT_CLASS} value={labTests} onChange={(e) => setLabTests(e.target.value)} placeholder="BMP, CBC, Lactate" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Priority</label>
                            <select className={INPUT_CLASS} value={labPriority} onChange={(e) => setLabPriority(e.target.value as typeof labPriority)}>
                                <option value="Routine">Routine</option>
                                <option value="Urgent">Urgent</option>
                                <option value="STAT">STAT</option>
                            </select>
                        </div>
                    </>
                )}

                {type === 'radiology' && (
                    <>
                        <div>
                            <label className={LABEL_CLASS}>Modality *</label>
                            <input className={INPUT_CLASS} value={radModality} onChange={(e) => setRadModality(e.target.value)} placeholder="CT" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Body region *</label>
                            <input className={INPUT_CLASS} value={radBodyRegion} onChange={(e) => setRadBodyRegion(e.target.value)} placeholder="Chest" />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Priority</label>
                            <select className={INPUT_CLASS} value={radPriority} onChange={(e) => setRadPriority(e.target.value as typeof radPriority)}>
                                <option value="Routine">Routine</option>
                                <option value="Urgent">Urgent</option>
                                <option value="STAT">STAT</option>
                            </select>
                        </div>
                        <div className="sm:col-span-4">
                            <label className={LABEL_CLASS}>Clinical indication *</label>
                            <input className={INPUT_CLASS} value={radIndication} onChange={(e) => setRadIndication(e.target.value)} placeholder="r/o PE" />
                        </div>
                        <p className="sm:col-span-4 text-[11px] text-gray-500 dark:text-gray-400">
                            Radiology orders require a physician — nurse accounts will be rejected by the server.
                        </p>
                    </>
                )}
            </div>

            <div className="mt-3 flex justify-end">
                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Place order
                </button>
            </div>
        </div>
    );
}
