import React, { memo, useMemo } from 'react';
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
        <div className="shrink-0 rounded-xl border border-white-light dark:border-dark bg-white dark:bg-black/20 px-3 py-2 sm:px-4">
            <div className="flex flex-wrap gap-x-4 gap-y-2 items-start">
                {groups.map((g) => (
                    <div
                        key={g.title}
                        className={`flex min-w-0 max-w-full sm:max-w-[32%] border-l-4 pl-2 ${toneBorder[g.tone]}`}
                    >
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 shrink-0 mr-1.5">{g.title}:</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2" title={g.items.join(' · ')}>
                            {g.items.join(' · ')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const IpdAlertsStrip = memo(IpdAlertsStripInner);
