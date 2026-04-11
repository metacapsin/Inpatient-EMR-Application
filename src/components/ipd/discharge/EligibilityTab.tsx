import React, { memo, useState } from 'react';
import { Button } from '../../ui/button';
import type { EligibilityRecord } from '../../../types/dischargeReadiness';

type Props = {
    history: EligibilityRecord[];
    canRun: boolean;
    onRunCheck: () => Promise<boolean>;
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
    const [running, setRunning] = useState(false);
    const latest = history[0];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={!canRun || running} onClick={() => void (async () => {
                    setRunning(true);
                    await onRunCheck();
                    setRunning(false);
                })()}>
                    {running ? 'Checking…' : 'Run eligibility (270 / 271)'}
                </Button>
                {!canRun ? <span className="text-sm text-gray-500">Your role cannot run eligibility.</span> : null}
            </div>

            {latest ? (
                <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Latest response</h3>
                        {statusBadge(latest.status)}
                    </div>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{latest.displaySummary}</p>
                    <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                        <div>
                            <dt className="text-xs uppercase text-gray-500">Requested</dt>
                            <dd>{new Date(latest.requestedAt).toLocaleString()}</dd>
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
                                <dt className="text-xs uppercase text-gray-500">Error</dt>
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
                                <th className="p-2 font-medium">Summary</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-3 text-gray-500">
                                        No rows
                                    </td>
                                </tr>
                            ) : (
                                history.map((h) => (
                                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="p-2 whitespace-nowrap">{new Date(h.requestedAt).toLocaleString()}</td>
                                        <td className="p-2">{statusBadge(h.status)}</td>
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
