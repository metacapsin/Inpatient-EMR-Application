import { differenceInMinutes, format, isValid, parseISO } from 'date-fns';
import type { EvsStatus } from '../../constants/evs';
import { EVS_QUEUE_OVERDUE_MINUTES, EVS_STATUS } from '../../constants/evs';
import type { EvsQueueItem } from '../../types/evs';

export type EvsQueueActionId =
    | 'assign'
    | 'start'
    | 'complete'
    | 'inspect'
    | 'approve';

export interface EvsQueueActionDef {
    id: EvsQueueActionId;
    label: string;
}

export function formatEvsTimestamp(isoStr: string | undefined): string {
    if (!isoStr?.trim()) return '—';
    try {
        const d = parseISO(isoStr);
        if (!isValid(d)) return isoStr;
        return format(d, 'MMM d, yyyy HH:mm');
    } catch {
        return isoStr;
    }
}

export function queueWaitMinutes(dirtyAt: string | undefined, now = Date.now()): number {
    if (!dirtyAt?.trim()) return 0;
    try {
        const d = parseISO(dirtyAt);
        if (!isValid(d)) return 0;
        return Math.max(0, differenceInMinutes(new Date(now), d));
    } catch {
        return 0;
    }
}

export function formatQueueDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function isQueueOverdue(minutes: number): boolean {
    return minutes > EVS_QUEUE_OVERDUE_MINUTES;
}

export function getActionsForStatus(status: EvsStatus, hasAssignee: boolean): EvsQueueActionDef[] {
    switch (status) {
        case EVS_STATUS.DIRTY:
            return [
                { id: 'assign', label: 'Assign' },
                { id: 'start', label: 'Start Cleaning' },
            ].filter((a) => (a.id === 'start' ? hasAssignee : true));
        case EVS_STATUS.IN_CLEANING:
            return [{ id: 'complete', label: 'Complete Cleaning' }];
        case EVS_STATUS.PENDING_INSPECTION:
            return [
                { id: 'inspect', label: 'Inspect' },
                { id: 'approve', label: 'Approve Clean' },
            ];
        default:
            return [];
    }
}

export function itemHasAssignee(item: EvsQueueItem): boolean {
    return Boolean(item.assignedHousekeeperId?.trim() || item.assignedHousekeeperName?.trim());
}
