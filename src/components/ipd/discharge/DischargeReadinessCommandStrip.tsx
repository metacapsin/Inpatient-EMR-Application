import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { useDischargeFinalizeFlow } from '../../../hooks/useDischargeFinalizeFlow';
import { dischargeProgressPercent, resolveFinalizeGates } from '../../../utils/dischargeReadinessUi';
import { AppModal } from '../../shared/AppModal';

export function DischargeReadinessCommandStrip() {
    const { encounterId, view } = useDischargeReadiness();
    const flow = useDischargeFinalizeFlow(encounterId, view);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const gates = useMemo(
        () => resolveFinalizeGates(view, flow.gatesForUi),
        [view, flow.gatesForUi]
    );
    const progress = dischargeProgressPercent(gates);
    const dischargeReady = flow.blockingReasons.length === 0 && flow.gatesForUi !== null;
    const readinessError =
        flow.readinessQuery.isError && flow.readinessQuery.error instanceof Error
            ? flow.readinessQuery.error.message
            : flow.readinessQuery.isError
              ? 'Could not load readiness'
              : null;

    const encounterDisplay = view.context.encounterId;
    const encounterShort =
        encounterDisplay.length > 12 ? `…${encounterDisplay.slice(-10)}` : encounterDisplay;

    return (
        <>
            <div className="w-full border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur-md dark:border-gray-700/80 dark:bg-[#0c0a08]/95">
                <div className="flex w-full flex-col gap-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-lg font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
                                {view.context.patientName}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                                <span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Encounter</span>{' '}
                                    <span className="font-mono text-gray-900 dark:text-gray-100" title={encounterDisplay}>
                                        {encounterShort}
                                    </span>
                                </span>
                                <span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Bed / Ward</span>{' '}
                                    <span className="text-gray-900 dark:text-gray-100">{view.context.locationLabel}</span>
                                </span>
                                {view.context.mrn ? (
                                    <span>
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">MRN</span>{' '}
                                        {view.context.mrn}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-center">
                            <div className="flex justify-center">
                                {flow.readinessQuery.isLoading ? (
                                    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                        Checking readiness…
                                    </span>
                                ) : dischargeReady ? (
                                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                                        Ready
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100">
                                        <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.65)]" />
                                        Blocked
                                    </span>
                                )}
                            </div>

                            <div className="flex w-full justify-center lg:w-auto lg:justify-end">
                                <button
                                    type="button"
                                    disabled={!flow.canFinalize}
                                    onClick={() => setConfirmOpen(true)}
                                    className="inline-flex min-h-[48px] w-full min-w-[200px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-base font-semibold text-white shadow-lg shadow-slate-900/25 transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:shadow-black/20 dark:hover:bg-gray-100 sm:w-auto"
                                >
                                    Finalize Discharge
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">Discharge progress</span>
                            <span className="text-gray-600 dark:text-gray-400">{progress}% complete</span>
                        </div>
                        <div
                            className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
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
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Tracks summary, medications, billing clearance, and insurance verification.
                        </p>
                    </div>

                    {readinessError ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                            {readinessError}
                        </p>
                    ) : null}

                    {flow.derivedFromClinical ? (
                        <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100">
                            Readiness API unavailable — progress and gates reflect this workspace until the server
                            endpoint is live.
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
