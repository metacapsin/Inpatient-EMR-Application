import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, Loader2, XCircle } from 'lucide-react';
import { formatMoney, formatStediDate, type EligibilityBenefitLine, type EligibilitySummary } from '../../services/eligibility.service';

interface CoverageResultPanelProps {
    summary: EligibilitySummary | null;
    error?: string;
    loading?: boolean;
    /** Smaller header, no benefit table toggle by default. */
    compact?: boolean;
}

const STATUS: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    active: { label: 'Active coverage', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30', Icon: CheckCircle2 },
    inactive: { label: 'Inactive', cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30', Icon: XCircle },
    error: { label: 'Could not verify', cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30', Icon: AlertTriangle },
    unknown: { label: 'Unknown', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30', Icon: HelpCircle },
    skipped: { label: 'Not checked', cls: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10', Icon: HelpCircle },
};

export function EligibilityStatusBadge({ status }: { status: EligibilitySummary['status'] }) {
    const s = STATUS[status] ?? STATUS.unknown;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.cls}`}>
            <s.Icon className="h-3 w-3" aria-hidden />
            {s.label}
        </span>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-sm text-gray-900 dark:text-gray-100">{value}</p>
        </div>
    );
}

const amount = (b: EligibilityBenefitLine) =>
    b.benefitAmount !== undefined && b.benefitAmount !== null && b.benefitAmount !== '' ? formatMoney(b.benefitAmount) : b.benefitPercent !== undefined && b.benefitPercent !== '' ? `${Number(b.benefitPercent) * 100}%` : '—';

function BenefitRows({ title, rows }: { title: string; rows: EligibilityBenefitLine[] }) {
    if (!rows?.length) return null;
    return (
        <>
            {rows.slice(0, 6).map((b, i) => (
                <tr key={`${title}-${i}`} className="border-t border-gray-100 dark:border-white/5">
                    <td className="py-1 pr-2 text-xs text-gray-700 dark:text-gray-300">{i === 0 ? title : ''}</td>
                    <td className="py-1 pr-2 text-xs text-gray-600 dark:text-gray-400">{(b.serviceTypes ?? b.serviceTypeCodes ?? []).slice(0, 2).join(', ') || '—'}</td>
                    <td className="py-1 pr-2 text-xs text-gray-600 dark:text-gray-400">{b.timeQualifier || b.timeQualifierCode || '—'}</td>
                    <td className="py-1 text-right text-xs tabular-nums text-gray-900 dark:text-gray-100">{amount(b)}</td>
                </tr>
            ))}
        </>
    );
}

/** Renders a 271 summary the way EMR-ng's stedi-coverage-result does: status, plan, key amounts, errors, benefits. */
export function CoverageResultPanel({ summary, error, loading, compact }: CoverageResultPanelProps) {
    const [showBenefits, setShowBenefits] = useState(false);
    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking coverage with the payer…
            </div>
        );
    }
    if (!summary && !error) return null;
    if (!summary) {
        return (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
            </div>
        );
    }
    const d = summary.details ?? {};
    const problems = [...(summary.errors ?? []), ...(summary.error && !(summary.errors ?? []).includes(summary.error) ? [summary.error] : [])];
    const net = d.benefits?.inNetwork ?? {};
    const hasBenefits = Object.values(net).some((v) => Array.isArray(v) && v.length);
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#1f1d1a]">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <EligibilityStatusBadge status={summary.status} />
                    <span className="truncate font-medium text-gray-900 dark:text-white">{summary.planName || d.payer?.name || summary.payerName || 'Coverage'}</span>
                    {summary.inNetwork ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">In network</span> : null}
                </div>
                {summary.checkedAt ? <span className="text-[11px] text-gray-500 dark:text-gray-400">Checked {new Date(summary.checkedAt).toLocaleString()}</span> : null}
            </div>

            {problems.length ? (
                <ul className="mt-2 space-y-1">
                    {problems.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {p}
                        </li>
                    ))}
                </ul>
            ) : null}
            {summary.warnings?.length ? (
                <ul className="mt-1 space-y-0.5">
                    {summary.warnings.map((w, i) => <li key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</li>)}
                </ul>
            ) : null}

            {summary.status === 'active' || summary.status === 'inactive' ? (
                <div className={`mt-3 grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                    <Stat label="Payer" value={`${d.payer?.name || summary.payerName || '—'}${d.payer?.payorIdentification ? ` · ${d.payer.payorIdentification}` : ''}`} />
                    <Stat label="Plan type" value={d.insuranceType || '—'} />
                    <Stat label="Coverage level" value={d.coverageLevel || '—'} />
                    <Stat label="Group" value={d.groupNumber ? `${d.groupNumber}${d.groupDescription ? ` · ${d.groupDescription}` : ''}` : '—'} />
                    <Stat label="Effective" value={formatStediDate(summary.coverageStartDate)} />
                    <Stat label="Terminates" value={summary.coverageEndDate ? formatStediDate(summary.coverageEndDate) : '—'} />
                    <Stat label="Co-pay (in network)" value={formatMoney(summary.copay)} />
                    <Stat label="Deductible / OOP max" value={`${formatMoney(summary.deductible)} / ${formatMoney(summary.outOfPocketMax)}`} />
                    {d.subscriber?.memberId ? <Stat label="Member on file" value={`${d.subscriber.firstName ?? ''} ${d.subscriber.lastName ?? ''} · ${d.subscriber.memberId}`.trim()} /> : null}
                </div>
            ) : null}

            {hasBenefits ? (
                <div className="mt-3">
                    <button type="button" onClick={() => setShowBenefits((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" aria-expanded={showBenefits}>
                        <ChevronDown className={`h-3.5 w-3.5 transition ${showBenefits ? 'rotate-180' : ''}`} aria-hidden /> {showBenefits ? 'Hide' : 'Show'} in-network benefit details
                    </button>
                    {showBenefits ? (
                        <table className="mt-2 w-full">
                            <thead>
                                <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    <th className="pb-1 pr-2 font-semibold">Benefit</th><th className="pb-1 pr-2 font-semibold">Service</th><th className="pb-1 pr-2 font-semibold">Period</th><th className="pb-1 text-right font-semibold">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <BenefitRows title="Co-pay" rows={net.copay ?? []} />
                                <BenefitRows title="Coinsurance" rows={net.coinsurance ?? []} />
                                <BenefitRows title="Deductible" rows={net.deductible ?? []} />
                                <BenefitRows title="Out-of-pocket max" rows={net.outOfPocketMax ?? []} />
                                <BenefitRows title="Limitations" rows={net.limitations ?? []} />
                            </tbody>
                        </table>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
