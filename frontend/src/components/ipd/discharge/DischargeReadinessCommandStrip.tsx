import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { useDischargeFinalizeFlow } from '../../../hooks/useDischargeFinalizeFlow';
import {
    computeDischargeTabCompletion,
    dischargeWorkspaceProgressPercent,
} from '../../../utils/dischargeReadinessUi';
import { AppModal } from '../../shared/AppModal';

export function DischargeReadinessCommandStrip() {
    const { encounterId, view, snapshot } = useDischargeReadiness();
    const flow = useDischargeFinalizeFlow(encounterId, view);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [scrollCompact, setScrollCompact] = useState(false);

    const dischargeSummarySigned = view.summary.status === 'signed';
    const progress = useMemo(
        () => dischargeWorkspaceProgressPercent(snapshot, dischargeSummarySigned),
        [snapshot, dischargeSummarySigned],
    );
    const tabDone = useMemo(() => computeDischargeTabCompletion(view, snapshot), [view, snapshot]);
    const allTabsComplete = useMemo(
        () =>
            tabDone.summary &&
            tabDone.checklist &&
            tabDone.charges &&
            tabDone.insurance &&
            tabDone.billing,
        [tabDone],
    );
    const completionCompact = progress >= 100 || allTabsComplete;
    /** Tighter chrome when scrolled; identifiers stay visible (never screen-reader-only). */
    const stripMinimal = scrollCompact;

    useEffect(() => {
        const onScroll = () => setScrollCompact(typeof window !== 'undefined' && window.scrollY > 32);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const dischargeReady = !flow.readinessQuery.isLoading && flow.canFinalize;
    const readinessError =
        flow.readinessQuery.isError && flow.readinessQuery.error instanceof Error
            ? flow.readinessQuery.error.message
            : flow.readinessQuery.isError
              ? 'Could not load readiness'
              : null;

    const encounterDisplay = view.context.encounterId;

    const contextDetails = [
        `Encounter: ${encounterDisplay}`,
        `Bed / Ward: ${view.context.locationLabel}`,
        view.context.mrn ? `MRN: ${view.context.mrn}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const progressHelp =
        'Tracks signed discharge summary, clinical discharge readiness, and billing readiness (same as header and Billing tab).';

    return (
        <>
            <div
                className={`sticky top-0 z-40 w-full border-b border-gray-200/80 bg-white/95 backdrop-blur-md transition-[box-shadow] dark:border-gray-700/80 dark:bg-[#0c0a08]/95 ${
                    stripMinimal ? 'shadow-sm' : ''
                }`}
            >
                <div className={`flex w-full flex-col ${stripMinimal ? 'gap-1.5 py-1.5' : 'gap-2 py-2'}`}>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                        <div className="min-w-0 flex-1 space-y-0.5">
                            <p
                                className={`font-semibold leading-tight tracking-tight text-gray-900 dark:text-white ${
                                    stripMinimal ? 'text-sm' : 'text-base'
                                }`}
                                title={contextDetails}
                            >
                                {view.context.patientName}
                            </p>
                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs leading-snug text-gray-600 dark:text-gray-400">
                                <span className="min-w-0 break-all">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Encounter</span>{' '}
                                    <span className="font-mono text-gray-900 dark:text-gray-100" title={encounterDisplay}>
                                        {encounterDisplay}
                                    </span>
                                </span>
                                <span className="hidden text-gray-300 sm:inline dark:text-gray-600" aria-hidden>
                                    |
                                </span>
                                <span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Bed / Ward</span>{' '}
                                    <span className="text-gray-900 dark:text-gray-100">{view.context.locationLabel}</span>
                                </span>
                                {view.context.mrn ? (
                                    <>
                                        <span className="hidden text-gray-300 sm:inline dark:text-gray-600" aria-hidden>
                                            |
                                        </span>
                                        <span>
                                            <span className="font-medium text-gray-700 dark:text-gray-300">MRN</span>{' '}
                                            {view.context.mrn}
                                        </span>
                                    </>
                                ) : null}
                                {completionCompact ? (
                                    <>
                                        <span className="hidden text-gray-300 sm:inline dark:text-gray-600" aria-hidden>
                                            |
                                        </span>
                                        <span className="tabular-nums text-gray-500 dark:text-gray-500" title={progressHelp}>
                                            Workspace {progress}%
                                        </span>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <div
                            className={`flex flex-shrink-0 flex-col items-stretch sm:flex-row sm:items-center sm:justify-end ${
                                stripMinimal ? 'gap-1.5' : 'gap-2'
                            }`}
                        >
                            <div className="flex justify-center sm:justify-end">
                                {flow.readinessQuery.isLoading ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                        Checking readiness…
                                    </span>
                                ) : dischargeReady ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.65)]" />
                                        Discharge ready
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.55)]" />
                                        Blocked
                                    </span>
                                )}
                            </div>

                            <div className="flex w-full justify-center sm:w-auto sm:justify-end">
                                <button
                                    type="button"
                                    disabled={!flow.canFinalize}
                                    onClick={() => setConfirmOpen(true)}
                                    className="inline-flex w-full min-w-[140px] items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm shadow-slate-900/15 transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:shadow-black/20 dark:hover:bg-gray-100 sm:w-auto min-h-9 py-2"
                                >
                                    Finalize Discharge
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="shrink-0 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                Progress
                            </span>
                            <div
                                className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
                                role="progressbar"
                                aria-valuenow={progress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label="Discharge readiness progress"
                            >
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-[width] duration-500 ease-out dark:from-emerald-500 dark:to-teal-400"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="shrink-0 tabular-nums text-[11px] font-medium text-gray-600 dark:text-gray-400">
                                {progress}%
                            </span>
                        </div>
                        <p className="text-[10px] leading-tight text-gray-500 dark:text-gray-500 sm:max-w-[55%] sm:text-end">
                            {progressHelp}
                        </p>
                    </div>

                    {readinessError ? (
                        <p className="border-l-2 border-red-400 bg-red-50/80 py-1 pl-2 pr-1 text-[11px] leading-snug text-red-800 dark:border-red-500 dark:bg-red-950/35 dark:text-red-200">
                            {readinessError}
                        </p>
                    ) : null}

                    {flow.derivedFromClinical ? (
                        <p className="border-l-2 border-amber-400 bg-amber-50/70 py-1 pl-2 pr-1 text-[11px] leading-snug text-amber-950 dark:border-amber-500 dark:bg-amber-950/30 dark:text-amber-100">
                            Readiness API unavailable — progress and gates reflect this workspace until the server endpoint is
                            live.
                        </p>
                    ) : null}
                </div>
            </div>

            <AppModal
                open={confirmOpen}
                onClose={() => {
                    if (!flow.finalizeMutation.isPending) setConfirmOpen(false);
                }}
                title="Confirm Discharge"
                description="Review the following before you continue."
                size="md"
                footer={
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            disabled={flow.finalizeMutation.isPending}
                            onClick={() => setConfirmOpen(false)}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={flow.finalizeMutation.isPending}
                            onClick={() => {
                                flow.finalizeMutation.mutate(undefined, {
                                    onSuccess: () => setConfirmOpen(false),
                                    onError: () => setConfirmOpen(false),
                                });
                            }}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                        >
                            {flow.finalizeMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    Confirming…
                                </>
                            ) : (
                                'Confirm Discharge'
                            )}
                        </button>
                    </div>
                }
            >
                <p className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">This will:</p>
                <ul className="list-inside list-disc space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>Release bed</li>
                    <li>Close encounter</li>
                    <li>Lock billing</li>
                    <li>Complete patient discharge</li>
                </ul>
            </AppModal>
        </>
    );
}
