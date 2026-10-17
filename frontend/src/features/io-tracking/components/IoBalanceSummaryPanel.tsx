import { AlertTriangle, Droplets, Loader2, RefreshCw } from 'lucide-react';
import type { IoBalanceSummary } from '../types/ioRecord.types';
import {
    balance24hCritical,
    balancePanelClass,
    balanceSeverity,
    balanceToneClass,
    formatBalanceMl,
    urineOutputAlert,
} from '../utils/balancePresentation';

const METRIC_LABEL =
    'text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const METRIC_VALUE = 'text-sm font-bold tabular-nums';

type IoBalanceSummaryPanelProps = {
    summary: IoBalanceSummary;
    loading?: boolean;
    refreshing?: boolean;
    onRefresh?: () => void;
};

function MetricCell({ label, value, toneClass }: { label: string; value: string; toneClass?: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-gray-200/80 bg-white/80 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.03]">
            <span className={METRIC_LABEL}>{label}</span>
            <span className={`${METRIC_VALUE} ${toneClass ?? 'text-gray-900 dark:text-white'}`}>{value}</span>
        </div>
    );
}

export function IoBalanceSummaryPanel({ summary, loading, refreshing, onRefresh }: IoBalanceSummaryPanelProps) {
    const sev8 = balanceSeverity(summary.balance8hMl);
    const sev24 = balanceSeverity(summary.balance24hMl);
    const lowUrine = urineOutputAlert(summary);
    const critical24 = balance24hCritical(summary);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200/80 bg-white px-4 py-8 dark:border-white/10 dark:bg-[#141210]">
                <Loader2 className="h-5 w-5 animate-spin text-primary/80" aria-hidden />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Loading I&amp;O balance…</span>
            </div>
        );
    }

    return (
        <section
            aria-label="I and O balance summary"
            className={`rounded-xl border px-3 py-3 shadow-sm transition-colors sm:px-4 ${balancePanelClass(sev24)}`}
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" aria-hidden />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Balance summary</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Display only
                    </span>
                </div>
                {onRefresh ? (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-primary/40 hover:text-primary disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                        Refresh
                    </button>
                ) : null}
            </div>

            {(lowUrine || critical24) && (
                <div
                    role="alert"
                    className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50/90 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <div className="space-y-0.5">
                        {lowUrine ? <p>Urine output &lt; 30 mL/hr — assess perfusion and fluid status.</p> : null}
                        {critical24 ? <p>24h fluid balance {formatBalanceMl(summary.balance24hMl)} — clinical alert threshold met.</p> : null}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                <MetricCell label="8h Intake" value={`${summary.intake8hMl.toLocaleString()} mL`} />
                <MetricCell label="8h Output" value={`${summary.output8hMl.toLocaleString()} mL`} />
                <MetricCell
                    label="8h Balance"
                    value={formatBalanceMl(summary.balance8hMl)}
                    toneClass={balanceToneClass(sev8)}
                />
                <MetricCell label="24h Intake" value={`${summary.intake24hMl.toLocaleString()} mL`} />
                <MetricCell label="24h Output" value={`${summary.output24hMl.toLocaleString()} mL`} />
                <MetricCell
                    label="24h Balance"
                    value={formatBalanceMl(summary.balance24hMl)}
                    toneClass={balanceToneClass(sev24)}
                />
                <MetricCell
                    label="Urine (last hr)"
                    value={`${summary.urineOutputLastHourMl.toLocaleString()} mL`}
                    toneClass={lowUrine ? 'text-red-700 dark:text-red-300' : undefined}
                />
            </div>
        </section>
    );
}
