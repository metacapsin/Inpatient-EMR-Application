import React, { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { IpdAlerts } from '../../types/ipdDashboard';

type Props = {
    alerts: IpdAlerts;
};

function IpdAlertsStripInner({ alerts }: Props) {
    const groups = useMemo(() => {
        const g: { title: string; items: string[]; tone: 'danger' | 'warning' | 'info' }[] = [];
        if (alerts.criticalPatients.length)
            g.push({ title: 'Critical patients', items: alerts.criticalPatients, tone: 'danger' });
        if (alerts.bedsPendingCleaning.length)
            g.push({ title: 'Beds pending cleaning', items: alerts.bedsPendingCleaning, tone: 'warning' });
        if (alerts.transferRequests.length)
            g.push({ title: 'Transfer requests', items: alerts.transferRequests, tone: 'info' });
        return g;
    }, [alerts]);

    if (groups.length === 0) return null;

    const toneBorder = {
        danger: 'border-l-danger',
        warning: 'border-l-warning',
        info: 'border-l-info',
    } as const;

    return (
        <div className="shrink-0 rounded-xl border border-emr-border/90 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(31,41,55,0.04)] dark:border-white/10 dark:bg-[#161412]/90 sm:px-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emr-muted dark:text-gray-500">
                Operational alerts
            </p>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                {groups.map((g) => (
                    <div
                        key={g.title}
                        className={`flex min-w-0 max-w-full sm:max-w-[32%] border-l-4 pl-2 ${toneBorder[g.tone]}`}
                    >
                        {g.title === 'Beds pending cleaning' ? (
                            <Link
                                to="/app/operations/evs-queue"
                                className="group flex min-w-0 flex-1 flex-col gap-0.5 rounded-md pr-1 transition hover:bg-amber-50/80 dark:hover:bg-amber-950/20"
                            >
                                <span className="text-xs font-semibold text-amber-800 underline-offset-2 group-hover:underline dark:text-amber-200">
                                    {g.title} ({g.items.length})
                                </span>
                                <span
                                    className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2"
                                    title={g.items.join(' · ')}
                                >
                                    {g.items.join(' · ')} — open EVS queue
                                </span>
                            </Link>
                        ) : (
                            <>
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 shrink-0 mr-1.5">
                                    {g.title}:
                                </span>
                                <span
                                    className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2"
                                    title={g.items.join(' · ')}
                                >
                                    {g.items.join(' · ')}
                                </span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export const IpdAlertsStrip = memo(IpdAlertsStripInner);
