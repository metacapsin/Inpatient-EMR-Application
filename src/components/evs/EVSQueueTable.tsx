import { useMemo } from 'react';
import type { EvsQueueItem } from '../../types/evs';
import { EVS_STATUS } from '../../constants/evs';
import { EVSActionButton } from './EVSActionButton';
import { EVSStatusChip } from './EVSStatusChip';
import { EVSQueueTableSkeleton } from './EVSQueueTableSkeleton';
import {
    formatEvsTimestamp,
    formatQueueDuration,
    getActionsForStatus,
    isQueueOverdue,
    itemHasAssignee,
    queueWaitMinutes,
} from './evsQueueUtils';
import type { EvsQueueActionId } from './evsQueueUtils';

interface EVSQueueTableProps {
    items: EvsQueueItem[];
    loading: boolean;
    nowTick: number;
    actionPendingId: string | null;
    onAction: (action: EvsQueueActionId, item: EvsQueueItem) => void;
}

function QueueTimeCell({ dirtyAt, status, nowTick }: { dirtyAt?: string; status: string; nowTick: number }) {
    void nowTick;
    if (status === EVS_STATUS.CLEAN || !dirtyAt) {
        return <span className="text-gray-500 dark:text-gray-400">—</span>;
    }
    const minutes = queueWaitMinutes(dirtyAt);
    const overdue = isQueueOverdue(minutes);
    return (
        <span
            className={[
                'font-mono text-xs font-semibold tabular-nums',
                overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200',
            ].join(' ')}
        >
            {formatQueueDuration(minutes)}
        </span>
    );
}

export function EVSQueueTable({ items, loading, nowTick, actionPendingId, onAction }: EVSQueueTableProps) {
    const sorted = useMemo(
        () =>
            [...items].sort((a, b) => {
                const ta = a.dirtyAt ? new Date(a.dirtyAt).getTime() : 0;
                const tb = b.dirtyAt ? new Date(b.dirtyAt).getTime() : 0;
                return tb - ta;
            }),
        [items]
    );

    return (
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#1a1a1a]">
            <div className="max-h-full overflow-auto overscroll-contain">
                <table className="w-full min-w-[1100px] text-left text-xs">
                    <thead className="sticky top-0 z-10 border-b border-gray-200/80 bg-gray-50/95 text-[10px] font-bold uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#1c1c1c]/95 dark:text-gray-400">
                        <tr>
                            <th className="px-2.5 py-2">Room / Bed</th>
                            <th className="px-2.5 py-2">Ward</th>
                            <th className="px-2.5 py-2">Patient just discharged</th>
                            <th className="px-2.5 py-2">Discharge time</th>
                            <th className="px-2.5 py-2">Time in queue</th>
                            <th className="px-2.5 py-2">Clean type</th>
                            <th className="px-2.5 py-2">Assigned housekeeper</th>
                            <th className="px-2.5 py-2">Status</th>
                            <th className="px-2.5 py-2">Started at</th>
                            <th className="px-2.5 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/90 dark:divide-white/[0.05]">
                        {loading ? (
                            <EVSQueueTableSkeleton />
                        ) : sorted.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-0">
                                    <div className="p-4" />
                                </td>
                            </tr>
                        ) : (
                            sorted.map((item) => {
                                const waitMin =
                                    item.dirtyAt && item.evsStatus !== EVS_STATUS.CLEAN
                                        ? queueWaitMinutes(item.dirtyAt, nowTick)
                                        : 0;
                                const rowOverdue = isQueueOverdue(waitMin) && item.evsStatus !== EVS_STATUS.CLEAN;
                                const actions = getActionsForStatus(item.evsStatus, itemHasAssignee(item));
                                const busy = actionPendingId === item.id;

                                return (
                                    <tr
                                        key={item.id}
                                        className={[
                                            'transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.04]',
                                            rowOverdue ? 'bg-red-50/40 dark:bg-red-950/15' : '',
                                        ].join(' ')}
                                    >
                                        <td className="px-2.5 py-2 font-medium text-gray-900 dark:text-white">
                                            {item.roomBedLabel}
                                        </td>
                                        <td className="px-2.5 py-2 text-gray-800 dark:text-gray-200">{item.wardName}</td>
                                        <td className="max-w-[140px] truncate px-2.5 py-2 text-gray-800 dark:text-gray-200">
                                            {item.dischargedPatientName ?? '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-2.5 py-2 text-gray-600 dark:text-gray-300">
                                            {formatEvsTimestamp(item.dischargeTime)}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <QueueTimeCell dirtyAt={item.dirtyAt} status={item.evsStatus} nowTick={nowTick} />
                                        </td>
                                        <td className="px-2.5 py-2 text-gray-700 dark:text-gray-300">{item.cleaningType ?? '—'}</td>
                                        <td className="px-2.5 py-2 text-gray-700 dark:text-gray-300">
                                            {item.assignedHousekeeperName ?? '—'}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <EVSStatusChip status={item.evsStatus} />
                                        </td>
                                        <td className="whitespace-nowrap px-2.5 py-2 text-gray-600 dark:text-gray-300">
                                            {formatEvsTimestamp(item.cleaningStartedAt)}
                                        </td>
                                        <td className="px-2.5 py-2 text-right">
                                            <div className="flex flex-wrap justify-end gap-1">
                                                {actions.map((act) => (
                                                    <EVSActionButton
                                                        key={act.id}
                                                        label={act.label}
                                                        disabled={busy}
                                                        variant={act.id === 'approve' ? 'primary' : 'secondary'}
                                                        onClick={() => onAction(act.id, item)}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
