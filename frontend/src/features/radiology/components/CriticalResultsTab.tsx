import { useMemo } from 'react';
import type { RadiologyOrder } from '../types/radiologyOrder.types';
import { formatRadiologyDateTime, resolveOrderId } from '../utils/radiologyMappers';
import { RadiologyEmptyState } from './RadiologyEmptyState';

const CARD_CLASS =
    'rounded-xl border border-red-300/80 bg-red-50/50 shadow-sm dark:border-red-500/40 dark:bg-red-950/20';

type CriticalResultsTabProps = {
    orders: RadiologyOrder[];
};

export function CriticalResultsTab({ orders }: CriticalResultsTabProps) {
    const critical = useMemo(() => orders.filter((o) => o.criticalValue === true), [orders]);

    if (!critical.length) {
        return (
            <RadiologyEmptyState
                title="No critical imaging results"
                description="Studies flagged as critical value will display notification details and read-back timestamps in this panel."
            />
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-1.5 lg:px-3 [scrollbar-width:thin]">
            {critical.map((order) => (
                <article key={resolveOrderId(order)} className={CARD_CLASS}>
                    <div
                        role="alert"
                        className="border-b border-red-300/60 bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white dark:border-red-500/50 dark:bg-red-800"
                    >
                        Critical imaging result — immediate review required
                    </div>
                    <div className="space-y-3 p-4 text-xs">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {order.modality} · {order.bodyRegion} · {formatRadiologyDateTime(order.performedAt ?? order.resultedAt)}
                        </p>
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-12 md:col-span-6">
                                <p className="text-[10px] font-bold uppercase text-red-800 dark:text-red-300">Notified to</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {order.criticalValueNotifiedTo?.trim() || '—'}
                                </p>
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <p className="text-[10px] font-bold uppercase text-red-800 dark:text-red-300">Notification time</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {formatRadiologyDateTime(order.criticalValueNotifiedAt)}
                                </p>
                            </div>
                        </div>
                        {order.impression?.trim() ? (
                            <div>
                                <p className="text-[10px] font-bold uppercase text-gray-500">Impression</p>
                                <p className="whitespace-pre-wrap font-medium text-gray-900 dark:text-gray-100">{order.impression}</p>
                            </div>
                        ) : null}
                        {order.findings?.trim() ? (
                            <div>
                                <p className="text-[10px] font-bold uppercase text-gray-500">Findings</p>
                                <p className="whitespace-pre-wrap font-medium text-gray-900 dark:text-gray-100">{order.findings}</p>
                            </div>
                        ) : null}
                    </div>
                </article>
            ))}
        </div>
    );
}
