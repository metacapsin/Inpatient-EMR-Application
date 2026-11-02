import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaCheckCircle as FaCheck, FaFlask, FaPlus, FaVial } from 'react-icons/fa';
import {
    acknowledgeResult,
    collectSpecimen,
    enterResults,
    flagClass,
    flagLabel,
    listOrderResults,
    updateLabOrderStatus,
    type LabResultInput,
    type LabResultRow,
} from '../../services/labs.service';

type Props = {
    orderId: string;
    orderStatus: string;
    labTests: Array<{ name?: string; code?: string; specimen?: string }>;
    accessionNumber?: string;
    specimenType?: string;
    collectedAt?: string | null;
    canCollect: boolean;
    canResult: boolean;
    canAcknowledge: boolean;
    onChanged: () => void | Promise<void>;
};

const cell = 'h-8 w-full min-w-0 rounded border border-gray-300 px-1.5 text-xs dark:border-gray-600 dark:bg-gray-800';

export const LAB_STATUS_CLASS: Record<string, string> = {
    Ordered: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    Collected: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    'In Progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    Resulted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

/** Expandable results area for one lab order: collect → enter results → acknowledge criticals. */
export function LabOrderResultsPanel({ orderId, orderStatus, labTests, accessionNumber, specimenType, collectedAt, canCollect, canResult, canAcknowledge, onChanged }: Props) {
    const [results, setResults] = useState<LabResultRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [entering, setEntering] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<LabResultInput[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setResults(await listOrderResults(orderId));
        } catch {
            toast.error('Could not load results');
        } finally {
            setLoading(false);
        }
    }, [orderId]);
    useEffect(() => {
        void load();
    }, [load]);

    function startEntry() {
        const done = new Set(results.filter((r) => r.status !== 'preliminary').map((r) => r.testName.toLowerCase()));
        const pending = labTests.filter((t) => t.name && !done.has(String(t.name).toLowerCase()));
        setDraft((pending.length ? pending : labTests).map((t) => ({ testName: String(t.name ?? ''), testCode: t.code ?? '', valueNum: null, valueText: '', unit: '', refLow: null, refHigh: null, status: 'final' })));
        setEntering(true);
    }

    async function collect() {
        setBusy(true);
        const r = await collectSpecimen(orderId, {});
        setBusy(false);
        if (!r.ok) return toast.error(r.message);
        toast.success(`Specimen collected · accession ${r.data.accessionNumber}`);
        await onChanged();
    }

    async function submitResults() {
        const clean = draft.filter((d) => d.testName.trim() && (d.valueNum !== null || (d.valueText ?? '').trim()));
        if (!clean.length) return toast.error('Enter at least one result value');
        setBusy(true);
        const r = await enterResults(orderId, clean.map((d) => ({ ...d, unit: d.unit || undefined, valueText: d.valueText || undefined, testCode: d.testCode || undefined })));
        setBusy(false);
        if (!r.ok) return toast.error(r.message);
        const crit = r.data.results.filter((x) => x.isCritical).length;
        toast.success(crit ? `${r.data.results.length} result(s) saved — ${crit} CRITICAL, physicians notified` : `${r.data.results.length} result(s) saved · order ${r.data.orderStatus}`);
        setEntering(false);
        await load();
        await onChanged();
    }

    async function ack(row: LabResultRow) {
        const r = await acknowledgeResult(row.id);
        if (!r.ok) return toast.error(r.message);
        toast.success(`${row.testName} acknowledged`);
        await load();
        await onChanged();
    }

    async function cancel() {
        setBusy(true);
        const r = await updateLabOrderStatus(orderId, 'Cancelled');
        setBusy(false);
        if (!r.ok) return toast.error(r.message);
        toast.success('Order cancelled');
        await onChanged();
    }

    const setD = (i: number, patch: Partial<LabResultInput>) => setDraft((p) => p.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    const num = (v: string) => (v.trim() === '' ? null : Number(v));

    return (
        <div className="mt-3 border-t border-white-light pt-3 dark:border-[#191e3a]">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                    {accessionNumber ? <span className="mr-3">Accession <span className="font-mono">{accessionNumber}</span></span> : null}
                    {specimenType ? <span className="mr-3">Specimen {specimenType}</span> : null}
                    {collectedAt ? <span>Collected {new Date(collectedAt).toLocaleString()}</span> : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {canCollect && orderStatus === 'Ordered' ? <button type="button" disabled={busy} className="btn btn-sm btn-outline-primary" onClick={() => void collect()}><FaVial className="mr-1 h-3 w-3" /> Collect specimen</button> : null}
                    {canResult && (orderStatus === 'Collected' || orderStatus === 'In Progress') && !entering ? <button type="button" className="btn btn-sm btn-primary" onClick={startEntry}><FaPlus className="mr-1 h-3 w-3" /> Enter results</button> : null}
                    {canCollect && ['Ordered', 'Collected', 'In Progress'].includes(orderStatus) ? <button type="button" disabled={busy} className="btn btn-sm btn-outline-danger" onClick={() => void cancel()}>Cancel order</button> : null}
                </div>
            </div>

            {entering ? (
                <div className="mt-2 overflow-x-auto rounded-lg border border-primary/30 bg-primary/5 p-2">
                    <table className="min-w-[720px] w-full text-left text-xs">
                        <thead className="text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-1 py-1">Test</th><th className="px-1 py-1">Code</th><th className="px-1 py-1">Value</th><th className="px-1 py-1">Text (if not numeric)</th><th className="px-1 py-1">Unit</th><th className="px-1 py-1">Ref low</th><th className="px-1 py-1">Ref high</th><th className="px-1 py-1">Status</th><th /></tr></thead>
                        <tbody>
                            {draft.map((d, i) => (
                                <tr key={i}>
                                    <td className="px-1 py-1"><input className={cell} value={d.testName} onChange={(e) => setD(i, { testName: e.target.value })} /></td>
                                    <td className="px-1 py-1"><input className={cell} value={d.testCode ?? ''} onChange={(e) => setD(i, { testCode: e.target.value })} placeholder="K" /></td>
                                    <td className="px-1 py-1"><input type="number" step="any" className={cell} value={d.valueNum ?? ''} onChange={(e) => setD(i, { valueNum: num(e.target.value) })} /></td>
                                    <td className="px-1 py-1"><input className={cell} value={d.valueText ?? ''} onChange={(e) => setD(i, { valueText: e.target.value })} /></td>
                                    <td className="px-1 py-1"><input className={cell} value={d.unit ?? ''} onChange={(e) => setD(i, { unit: e.target.value })} placeholder="mmol/L" /></td>
                                    <td className="px-1 py-1"><input type="number" step="any" className={cell} value={d.refLow ?? ''} onChange={(e) => setD(i, { refLow: num(e.target.value) })} /></td>
                                    <td className="px-1 py-1"><input type="number" step="any" className={cell} value={d.refHigh ?? ''} onChange={(e) => setD(i, { refHigh: num(e.target.value) })} /></td>
                                    <td className="px-1 py-1"><select className={cell} value={d.status ?? 'final'} onChange={(e) => setD(i, { status: e.target.value as 'final' | 'preliminary' })}><option value="final">final</option><option value="preliminary">preliminary</option></select></td>
                                    <td className="px-1 py-1"><button type="button" className="text-gray-400 hover:text-red-600" onClick={() => setDraft((p) => p.filter((_, idx) => idx !== i))}>×</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-2 flex flex-wrap justify-between gap-2">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setDraft((p) => [...p, { testName: '', valueNum: null, status: 'final' }])}>Add test</button>
                        <div className="flex gap-2">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEntering(false)}>Cancel</button>
                            <button type="button" disabled={busy} className="btn btn-sm btn-primary" onClick={() => void submitResults()}>{busy ? 'Saving…' : 'Save results'}</button>
                        </div>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">Abnormal flags are computed from the reference range; known panic values (K, Na, glucose, Hgb, platelets…) are flagged critical and notify physicians and nurses.</p>
                </div>
            ) : null}

            {loading ? (
                <p className="mt-2 text-xs text-gray-500">Loading results…</p>
            ) : results.length === 0 ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><FaFlask className="h-3 w-3" /> No results yet.</p>
            ) : (
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                        <thead className="text-[10px] uppercase tracking-wide text-gray-500"><tr><th className="px-1 py-1">Test</th><th className="px-1 py-1">Result</th><th className="px-1 py-1">Ref range</th><th className="px-1 py-1">Flag</th><th className="px-1 py-1">Resulted</th><th className="px-1 py-1">Ack</th></tr></thead>
                        <tbody>
                            {results.map((r) => (
                                <tr key={r.id} className={`border-t border-white-light dark:border-[#191e3a] ${r.isCritical && !r.acknowledgedAt ? 'bg-red-50/70 dark:bg-red-950/20' : ''}`}>
                                    <td className="px-1 py-1.5 font-medium text-gray-900 dark:text-white">{r.testName}{r.testCode ? <span className="ml-1 text-gray-400">({r.testCode})</span> : null}{r.status === 'corrected' ? <span className="ml-1 text-[10px] text-amber-700">corrected</span> : null}</td>
                                    <td className="px-1 py-1.5 font-semibold">{r.value} {r.unit}</td>
                                    <td className="px-1 py-1.5 text-gray-500">{r.referenceRange || '—'}</td>
                                    <td className="px-1 py-1.5"><span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${flagClass(r.abnormalFlag, r.isCritical)}`}>{r.isCritical ? 'CRITICAL · ' : ''}{flagLabel(r.abnormalFlag)}</span></td>
                                    <td className="px-1 py-1.5 text-gray-500">{r.resultedAt ? new Date(r.resultedAt).toLocaleString() : ''}{r.resultedByName ? ` · ${r.resultedByName}` : ''}</td>
                                    <td className="px-1 py-1.5">
                                        {r.isCritical ? (
                                            r.acknowledgedAt ? <span className="text-emerald-700" title={r.acknowledgedAt}><FaCheck className="inline h-3 w-3" /> {r.acknowledgedByName ?? 'acknowledged'}</span>
                                            : canAcknowledge ? <button type="button" className="btn btn-sm btn-danger py-0.5" onClick={() => void ack(r)}>Acknowledge</button>
                                            : <span className="text-red-700">unacknowledged</span>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
