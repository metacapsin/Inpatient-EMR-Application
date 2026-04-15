import React, { memo, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import type { EligibilityRecord } from '../../../types/dischargeReadiness';
import { useDischargeReadinessOptional } from '../../../contexts/DischargeReadinessContext';
import { eligibilityExpiresAtMs, formatEligibilityExpiryLabel } from '../../../utils/dischargeReadinessValidation';

type RunResult = { ok: true } | { ok: false; message: string };

type Props = {
    history: EligibilityRecord[];
    canRun: boolean;
    onRunCheck: () => Promise<RunResult>;
};

function statusBadge(status: EligibilityRecord['status']) {
    const map: Record<string, string> = {
        active: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
        inactive: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
        error: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
        unknown: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? map.unknown}`}>{status}</span>
    );
}

function EligibilityTabInner({ history, canRun, onRunCheck }: Props) {
    const ctx = useDischargeReadinessOptional();
    const [running, setRunning] = useState(false);
    const [runError, setRunError] = useState<string | null>(null);
    const latest = history[0];

    const gateMsg = useMemo(() => {
        const g = ctx?.snapshot.gates.find((x) => x.id === 'gate-eligibility');
        if (!g || g.resolved) return null;
        return g.message;
    }, [ctx?.snapshot]);

    const now = Date.now();
    const latestExpired = latest ? now >= eligibilityExpiresAtMs(latest) : false;

    return (
        <div className="space-y-3" data-insurance-tab>
            {gateMsg ? (
                <div
                    className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                    role="alert"
                >
                    <p className="font-medium">Discharge / billing hold (eligibility)</p>
                    <p className="mt-1">{gateMsg}</p>
                </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    disabled={!canRun || running}
                    onClick={() =>
                        void (async () => {
                            if (running) return;
                            setRunning(true);
                            setRunError(null);
                            try {
                                const res = await onRunCheck();
                                if (!res.ok) setRunError(res.message);
                            } catch {
                                setRunError('Eligibility check failed. Please try again.');
                            } finally {
                                setRunning(false);
                            }
                        })()
                    }
                >
                    {running ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            Checking…
                        </>
                    ) : (
                        'Run eligibility (270 / 271)'
                    )}
                </Button>
                {!canRun ? <span className="text-sm text-gray-500">Your role cannot run eligibility.</span> : null}
            </div>

            {runError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                    {runError}
                </div>
            ) : null}

            {latest ? (
                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Latest response</h3>
                        {statusBadge(latest.status)}
                        {latest.status === 'active' && latestExpired ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                                Expired (24h window)
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{latest.displaySummary}</p>
                    <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                        <div>
                            <dt className="text-xs uppercase text-gray-500">Requested</dt>
                            <dd>{new Date(latest.requestedAt).toLocaleString()}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-gray-500">Valid through</dt>
                            <dd>{formatEligibilityExpiryLabel(latest)}</dd>
                        </div>
                        {latest.planName ? (
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Plan</dt>
                                <dd>{latest.planName}</dd>
                            </div>
                        ) : null}
                        {latest.memberId ? (
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Member ID</dt>
                                <dd className="font-mono">{latest.memberId}</dd>
                            </div>
                        ) : null}
                        {latest.copayNote ? (
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Copay (summary)</dt>
                                <dd>{latest.copayNote}</dd>
                            </div>
                        ) : null}
                        {latest.deductibleNote ? (
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Deductible (summary)</dt>
                                <dd>{latest.deductibleNote}</dd>
                            </div>
                        ) : null}
                        {latest.priorAuthRequired != null ? (
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Prior auth flag</dt>
                                <dd>{latest.priorAuthRequired ? 'Yes (plan hint)' : 'Not indicated'}</dd>
                            </div>
                        ) : null}
                        {latest.errorCode ? (
                            <div>
                                <dt className="text-xs uppercase text-gray-500">Payer / gateway code</dt>
                                <dd className="text-red-700 dark:text-red-300">{latest.errorCode}</dd>
                            </div>
                        ) : null}
                    </dl>
                </div>
            ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No eligibility inquiry logged for this encounter yet.</p>
            )}

            <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">History</h3>
                <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/60">
                            <tr>
                                <th className="p-2 font-medium">When</th>
                                <th className="p-2 font-medium">Status</th>
                                <th className="p-2 font-medium">Valid through</th>
                                <th className="p-2 font-medium">Summary</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-3 text-gray-500">
                                        No rows
                                    </td>
                                </tr>
                            ) : (
                                history.map((h) => (
                                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="p-2 whitespace-nowrap">{new Date(h.requestedAt).toLocaleString()}</td>
                                        <td className="p-2">{statusBadge(h.status)}</td>
                                        <td className="p-2 whitespace-nowrap text-xs">{formatEligibilityExpiryLabel(h)}</td>
                                        <td className="p-2">{h.displaySummary}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export const EligibilityTab = memo(EligibilityTabInner);
