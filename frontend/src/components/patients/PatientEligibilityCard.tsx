import { useCallback, useEffect, useState } from 'react';
import { History, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    SERVICE_TYPE_OPTIONS,
    checkInlineEligibility,
    getEligibilityHistory,
    type EligibilitySummary,
} from '../../services/eligibility.service';
import { CoverageResultPanel, EligibilityStatusBadge } from './CoverageResultPanel';

interface PatientEligibilityCardProps {
    patientId: string;
    patient: { firstName?: string; lastName?: string; dOB?: string; sex?: string };
    slot: 'primary' | 'secondary';
    insurance: { insuranceCompany?: string; tradingPartnerServiceId?: string; subscriberId?: string; groupNumber?: string } | null | undefined;
}

/**
 * Demographics → Insurance Details: last eligibility result for one insurance slot plus a
 * "Check eligibility" action (POST /Eligibility/checkInline with patientId, so it is filed to history).
 * Mirrors EMR-ng's patient-coverage recheck.
 */
export function PatientEligibilityCard({ patientId, patient, slot, insurance }: PatientEligibilityCardProps) {
    const [history, setHistory] = useState<EligibilitySummary[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState('');
    const [serviceType, setServiceType] = useState('30');
    const [showHistory, setShowHistory] = useState(false);

    const load = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const rows = await getEligibilityHistory(patientId);
            setHistory(rows.filter((r) => r.slot === slot));
        } catch {
            setHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    }, [patientId, slot]);

    useEffect(() => { void load(); }, [load]);

    const latest = history[0] ?? null;
    const canCheck = Boolean(insurance?.subscriberId && patient.firstName && patient.lastName && patient.dOB);

    const check = async () => {
        if (!insurance) return;
        setChecking(true);
        setError('');
        try {
            const res = await checkInlineEligibility({
                patientId,
                firstName: patient.firstName ?? '',
                lastName: patient.lastName ?? '',
                dOB: patient.dOB ?? '',
                sex: patient.sex || undefined,
                serviceTypeCodes: [serviceType],
                [slot === 'primary' ? 'insurance' : 'secondaryInsurance']: insurance,
            });
            const summary = res[slot];
            if (!summary) { setError('No response for this insurance.'); return; }
            if (summary.status === 'active') toast.success('Coverage verified: active.');
            else if (summary.status === 'inactive') toast.error('Payer reports this coverage as inactive.');
            await load();
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Coverage check failed.');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Eligibility</span>
                    {latest && !checking ? <EligibilityStatusBadge status={latest.status} /> : null}
                    {latest?.checkedAt && !checking ? <span className="text-[11px] text-gray-500 dark:text-gray-400">last checked {new Date(latest.checkedAt).toLocaleString()}</span> : null}
                    {!latest && !loadingHistory && !checking ? <span className="text-[11px] text-gray-500 dark:text-gray-400">never checked</span> : null}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        aria-label="Service type"
                        className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none focus:border-primary dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        disabled={checking}
                    >
                        {SERVICE_TYPE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.code} · {o.label}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={check}
                        disabled={!canCheck || checking}
                        title={!canCheck ? 'Needs member ID plus patient name and DOB' : 'Run a real-time 270/271 check'}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
                    >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        {checking ? 'Checking…' : latest ? 'Re-check eligibility' : 'Check eligibility'}
                    </button>
                </div>
            </div>
            <CoverageResultPanel summary={checking ? null : latest} error={error} loading={checking} compact />
            {history.length > 1 ? (
                <div className="mt-2">
                    <button type="button" onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <History className="h-3.5 w-3.5" aria-hidden /> {showHistory ? 'Hide' : 'Show'} previous checks ({history.length - 1})
                    </button>
                    {showHistory ? (
                        <ul className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-xs dark:divide-white/5 dark:border-white/10 dark:bg-[#1f1d1a]">
                            {history.slice(1).map((h) => (
                                <li key={h.id ?? h.checkedAt} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                                    <span className="flex items-center gap-2"><EligibilityStatusBadge status={h.status} /> <span className="text-gray-700 dark:text-gray-300">{h.planName || h.payerName || h.error || '—'}</span></span>
                                    <span className="text-gray-500 dark:text-gray-400">{h.checkedAt ? new Date(h.checkedAt).toLocaleString() : ''}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
