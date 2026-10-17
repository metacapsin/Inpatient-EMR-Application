import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { getCoverageSummary } from '../../services/staffScheduling.service';
import { getWards } from '../../services/rooms.service';
import type { CoverageSummary } from '../../types/staffScheduling.types';

export function StaffCoverageWidget() {
    const [summary, setSummary] = useState<CoverageSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const wards = await getWards();
                const wardNames: Record<string, string> = {};
                wards.forEach((w) => {
                    wardNames[String(w.id)] = w.name;
                });
                const today = new Date().toISOString().slice(0, 10);
                const data = await getCoverageSummary({ date: today, wardNames });
                if (!cancelled) setSummary(data);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const openCount = summary?.openShiftCount ?? 0;
    const gapCount = summary?.understaffedWards.length ?? 0;
    const hasIssues = openCount > 0 || gapCount > 0;

    return (
        <div
            className={
                hasIssues
                    ? 'rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/95 via-amber-50/80 to-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(181,71,8,0.08)] dark:border-amber-900/45 dark:from-amber-950/30 dark:via-amber-950/20 dark:to-[#161412]/80 sm:px-4'
                    : 'rounded-xl border border-emr-border/90 bg-gradient-to-r from-emerald-50/50 via-white to-white px-3.5 py-2.5 dark:border-white/10 dark:from-emerald-950/15 dark:via-[#161412] dark:to-[#161412]/90 sm:px-4'
            }
            role="status"
            aria-live="polite"
        >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                    <span
                        className={
                            hasIssues
                                ? 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                : 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300'
                        }
                        aria-hidden
                    >
                        {hasIssues ? (
                            <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                        )}
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emr-muted dark:text-gray-500">
                                Today&apos;s coverage
                            </p>
                            {hasIssues ? (
                                <span className="inline-flex items-center rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                                    Action needed
                                </span>
                            ) : null}
                        </div>
                        {loading ? (
                            <p className="mt-0.5 text-sm text-emr-muted">Loading…</p>
                        ) : (
                            <p className="mt-0.5 text-sm font-semibold text-emr-text dark:text-white">
                                {hasIssues ? (
                                    <>
                                        <span className="tabular-nums text-amber-900 dark:text-amber-100">{openCount}</span>
                                        <span className="text-emr-muted dark:text-gray-400"> open</span>
                                        <span className="mx-1.5 text-emr-border dark:text-white/20">·</span>
                                        <span className="tabular-nums text-amber-900 dark:text-amber-100">{gapCount}</span>
                                        <span className="text-emr-muted dark:text-gray-400">
                                            {' '}
                                            understaffed ward{gapCount === 1 ? '' : 's'}
                                        </span>
                                    </>
                                ) : (
                                    'All wards meeting coverage targets'
                                )}
                            </p>
                        )}
                    </div>
                </div>
                <Link
                    to="/app/staff-scheduling?tab=open-shifts"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emr-accent/25 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emr-accent shadow-sm transition-all hover:border-emr-accent/40 hover:bg-emr-active hover:shadow dark:border-primary/30 dark:bg-[#1c1916] dark:text-primary-200 dark:hover:bg-primary/15"
                >
                    <Users className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    Open staff scheduling
                    <ArrowRight className="h-3 w-3 opacity-70" aria-hidden />
                </Link>
            </div>
        </div>
    );
}
