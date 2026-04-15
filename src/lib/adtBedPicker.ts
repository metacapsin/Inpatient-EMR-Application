import { filterAvailableBeds, type EmrBedListItem } from '../services/emrBeds.service';

export function bedOptionsForSelect(
    beds: EmrBedListItem[],
    opts: { excludeId?: string; onlyAvailable: boolean }
): { value: string; label: string; disabled?: boolean }[] {
    const list = opts.onlyAvailable ? filterAvailableBeds(beds) : beds;
    return list
        .filter((b) => !opts.excludeId || b.id !== opts.excludeId)
        .map((b) => ({
            value: b.id,
            label: `${b.label}${b.bedStatus && b.bedStatus !== 'available' ? ` (${b.bedStatus})` : ''}`,
            disabled: opts.onlyAvailable ? false : b.bedStatus !== '' && b.bedStatus !== 'available',
        }));
}

export function bedStatusIndicatorClass(status: string): string {
    const s = status.trim().toLowerCase();
    if (s === 'available' || s === '') {
        return 'bg-emerald-500';
    }
    if (s === 'occupied' || s === 'assigned' || s === 'held' || s === 'hold') {
        return 'bg-amber-500';
    }
    if (s === 'maintenance' || s === 'blocked' || s === 'unavailable') {
        return 'bg-red-500';
    }
    return 'bg-gray-400';
}

/** Pill/chip container classes aligned with appointment status badges. */
export function bedStatusPillClass(status: string): string {
    const s = status.trim().toLowerCase();
    if (s === 'available' || s === '') {
        return 'border border-emerald-100/90 bg-emerald-50/90 text-emerald-900/80 dark:border-emerald-900/35 dark:bg-emerald-950/30 dark:text-emerald-100/90';
    }
    if (s === 'occupied' || s === 'assigned' || s === 'held' || s === 'hold') {
        return 'border border-amber-100/90 bg-amber-50/90 text-amber-900/80 dark:border-amber-900/35 dark:bg-amber-950/30 dark:text-amber-100/90';
    }
    if (s === 'maintenance' || s === 'blocked' || s === 'unavailable') {
        return 'border border-rose-100/90 bg-rose-50/90 text-rose-900/80 dark:border-rose-900/40 dark:bg-rose-950/35 dark:text-rose-100/90';
    }
    return 'border border-gray-200/80 bg-gray-50/90 text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300';
}
