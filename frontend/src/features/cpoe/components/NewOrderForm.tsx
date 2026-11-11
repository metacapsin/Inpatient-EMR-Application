import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { placeOrder } from '../../../services/cpoeOrders.service';
import { checkInteractions, cdsAlertsFromError } from '../../../services/cds.service';
import { DrugTypeahead, type DrugSelection } from '../../../components/cds/DrugTypeahead';
import { CdsAlertPanel } from '../../../components/cds/CdsAlertPanel';
import type { CdsAlert, CdsCheckState } from '../../../types/cds';
import { requiresOverride } from '../../../types/cds';
import type { CpoeOrderRow, CpoeOrderType, PlaceOrderBody } from '../../../types/cpoeOrders';

const LABEL_CLASS = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const INPUT_CLASS =
    'w-full rounded-md border border-gray-200/80 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/30 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100';

type NewOrderFormProps = {
    patientId: string;
    encounterId: string;
    orderType: CpoeOrderType;
    onPlaced: (order: CpoeOrderRow) => void;
};

export function NewOrderForm({ patientId, encounterId, orderType: type, onPlaced }: NewOrderFormProps) {
    const [submitting, setSubmitting] = useState(false);

    const [medDrug, setMedDrug] = useState<DrugSelection>({ name: '', rxnormCode: null });
    const [medDose, setMedDose] = useState('');
    const [medRoute, setMedRoute] = useState('');
    const [medFrequency, setMedFrequency] = useState('');
    const [medScheduledFor, setMedScheduledFor] = useState('');

    const [prnDrug, setPrnDrug] = useState<DrugSelection>({ name: '', rxnormCode: null });
    const [prnKind, setPrnKind] = useState<'PRN' | 'STAT'>('PRN');
    const [prnIndication, setPrnIndication] = useState('');
    const [prnGivenBy, setPrnGivenBy] = useState('');

    const [labTests, setLabTests] = useState('');
    const [labPriority, setLabPriority] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');
    const [labIndication, setLabIndication] = useState('');

    const [radModality, setRadModality] = useState('');
    const [radBodyRegion, setRadBodyRegion] = useState('');
    const [radIndication, setRadIndication] = useState('');
    const [radPriority, setRadPriority] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');

    const [cdsState, setCdsState] = useState<CdsCheckState>({ status: 'idle' });
    const [blockingAlerts, setBlockingAlerts] = useState<CdsAlert[] | null>(null);
    const pendingBody = useRef<PlaceOrderBody | null>(null);
    const previewSeq = useRef(0);

    function resetForm() {
        setMedDrug({ name: '', rxnormCode: null });
        setMedDose('');
        setMedRoute('');
        setMedFrequency('');
        setMedScheduledFor('');
        setPrnDrug({ name: '', rxnormCode: null });
        setPrnIndication('');
        setPrnGivenBy('');
        setLabTests('');
        setLabIndication('');
        setRadModality('');
        setRadBodyRegion('');
        setRadIndication('');
        setCdsState({ status: 'idle' });
        setBlockingAlerts(null);
        pendingBody.current = null;
    }

    // Live CDS: immediate after coded RxNorm select; short debounce while typing free text.
    useEffect(() => {
        if (type !== 'medication' && type !== 'prn_stat') {
            setCdsState({ status: 'idle' });
            setBlockingAlerts(null);
            return;
        }
        if (!patientId.trim()) {
            setCdsState({ status: 'idle' });
            return;
        }
        const drug = type === 'medication' ? medDrug : prnDrug;
        if (!drug.name.trim()) {
            setCdsState({ status: 'idle' });
            setBlockingAlerts(null);
            return;
        }
        // New drug selection invalidates any open place-order override panel.
        setBlockingAlerts(null);
        pendingBody.current = null;

        const mine = ++previewSeq.current;
        setCdsState({ status: 'checking' });
        const delayMs = drug.rxnormCode ? 0 : 280;
        const t = window.setTimeout(async () => {
            const res = await checkInteractions(patientId, [
                { name: drug.name.trim(), rxnormCode: drug.rxnormCode },
            ]);
            if (mine !== previewSeq.current) return;
            if (!res.ok) setCdsState({ status: 'error', message: res.message });
            else setCdsState({ status: 'alerts', alerts: res.data });
        }, delayMs);
        return () => window.clearTimeout(t);
    }, [type, medDrug.name, medDrug.rxnormCode, prnDrug.name, prnDrug.rxnormCode, patientId]);

    function buildBody(): PlaceOrderBody | null {
        if (!encounterId.trim()) {
            toast.error('No active encounter for this patient — admit the patient first');
            return null;
        }
        if (type === 'medication') {
            if (!medDrug.name.trim()) {
                toast.error('Medication name is required');
                return null;
            }
            return {
                orderType: 'medication',
                patientId,
                encounterId,
                name: medDrug.name.trim(),
                dose: medDose.trim() || undefined,
                route: medRoute.trim() || undefined,
                frequency: medFrequency.trim() || undefined,
                nextScheduledTime: medScheduledFor ? new Date(medScheduledFor).toISOString() : undefined,
                rxnormCode: medDrug.rxnormCode,
            };
        }
        if (type === 'prn_stat') {
            if (!prnDrug.name.trim() || !prnIndication.trim() || !prnGivenBy.trim()) {
                toast.error('Medication, indication and given-by are required');
                return null;
            }
            return {
                orderType: 'prn_stat',
                patientId,
                encounterId,
                medicationName: prnDrug.name.trim(),
                type: prnKind,
                indication: prnIndication.trim(),
                orderedTime: new Date().toISOString(),
                givenBy: prnGivenBy.trim(),
                rxnormCode: prnDrug.rxnormCode,
            };
        }
        if (type === 'lab') {
            const tests = labTests
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((name) => ({ name }));
            if (!tests.length) {
                toast.error('At least one lab test is required');
                return null;
            }
            if (!labIndication.trim()) {
                toast.error('Clinical indication (reason for order) is required');
                return null;
            }
            return {
                orderType: 'lab',
                patientId,
                encounterId,
                labTests: tests,
                priority: labPriority,
                clinicalIndication: labIndication.trim(),
            };
        }
        if (!radModality.trim() || !radBodyRegion.trim() || !radIndication.trim()) {
            toast.error('Modality, body region and clinical indication are required');
            return null;
        }
        return {
            orderType: 'radiology',
            patientId,
            encounterId,
            modality: radModality.trim(),
            bodyRegion: radBodyRegion.trim(),
            clinicalIndication: radIndication.trim(),
            priority: radPriority,
        };
    }

    async function submitBody(body: PlaceOrderBody) {
        setSubmitting(true);
        try {
            const order = await placeOrder(body);
            toast.success('Order placed');
            resetForm();
            onPlaced(order);
        } catch (err) {
            const alerts = cdsAlertsFromError(err);
            if (alerts) {
                pendingBody.current = body;
                setBlockingAlerts(alerts);
            } else {
                const e = err as { response?: { data?: { message?: string } } };
                toast.error(e?.response?.data?.message || 'Could not place order');
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function handleSubmit() {
        const body = buildBody();
        if (!body) return;
        // Soft preview: if live check already shows hard alerts, open panel before server round-trip
        if ((body.orderType === 'medication' || body.orderType === 'prn_stat') && cdsState.status === 'alerts' && requiresOverride(cdsState.alerts) && !body.cdsOverride) {
            pendingBody.current = body;
            setBlockingAlerts(cdsState.alerts);
            return;
        }
        await submitBody(body);
    }

    const liveAlerts = cdsState.status === 'alerts' ? cdsState.alerts : [];

    return (
        <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {type === 'medication' && (
                    <>
                        <div className="sm:col-span-2">
                            <label className={LABEL_CLASS}>Medication *</label>
                            <DrugTypeahead id="cpoe-med" value={medDrug} onChange={setMedDrug} placeholder="Search medication…" />
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
                            <DrugTypeahead id="cpoe-prn" value={prnDrug} onChange={setPrnDrug} placeholder="Search medication…" />
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
                        <div className="sm:col-span-2">
                            <label className={LABEL_CLASS}>Indication *</label>
                            <input className={INPUT_CLASS} value={prnIndication} onChange={(e) => setPrnIndication(e.target.value)} placeholder="Severe pain" />
                        </div>
                    </>
                )}

                {type === 'lab' && (
                    <>
                        <div className="sm:col-span-2">
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
                        <div className="sm:col-span-2">
                            <label className={LABEL_CLASS}>Clinical indication *</label>
                            <input className={INPUT_CLASS} value={labIndication} onChange={(e) => setLabIndication(e.target.value)} placeholder="Reason for order, e.g. suspected hypokalaemia" />
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
                        <div className="sm:col-span-2">
                            <label className={LABEL_CLASS}>Clinical indication *</label>
                            <input className={INPUT_CLASS} value={radIndication} onChange={(e) => setRadIndication(e.target.value)} placeholder="r/o PE" />
                        </div>
                        <p className="sm:col-span-2 text-[11px] text-gray-500 dark:text-gray-400">
                            Radiology orders require a physician — nurse accounts will be rejected by the server.
                        </p>
                    </>
                )}
            </div>

            {(type === 'medication' || type === 'prn_stat') && cdsState.status === 'checking' ? (
                <p className="mt-2 text-[11px] text-gray-500">Checking interactions…</p>
            ) : null}
            {(type === 'medication' || type === 'prn_stat') && cdsState.status === 'error' ? (
                <p className="mt-2 text-[11px] text-danger" role="alert">
                    {cdsState.message}
                </p>
            ) : null}
            {/* Live CDS results immediately after drug selection (all severities). */}
            {(type === 'medication' || type === 'prn_stat') && liveAlerts.length > 0 && !blockingAlerts ? (
                <div className="mt-3">
                    <CdsAlertPanel alerts={liveAlerts} variant="preview" title="Clinical alerts for this medication" />
                </div>
            ) : null}

            {blockingAlerts ? (
                <div className="mt-3">
                    <CdsAlertPanel
                        alerts={blockingAlerts}
                        variant="blocking"
                        submitting={submitting}
                        onCancel={() => {
                            setBlockingAlerts(null);
                            pendingBody.current = null;
                        }}
                        onProceed={(reason) => {
                            const body = pendingBody.current;
                            if (!body) return;
                            const next = { ...body, cdsOverride: reason ? { reason } : undefined };
                            setBlockingAlerts(null);
                            void submitBody(next);
                        }}
                    />
                </div>
            ) : (
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        disabled={submitting || cdsState.status === 'checking'}
                        onClick={() => void handleSubmit()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                        Place order
                    </button>
                </div>
            )}
        </div>
    );
}
