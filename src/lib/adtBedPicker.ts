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
    if (s === 'occupied' || s === 'assigned' || s === 'held') {
        return 'bg-amber-500';
    }
    if (s === 'maintenance' || s === 'blocked' || s === 'unavailable') {
        return 'bg-red-500';
    }
    return 'bg-gray-400';
}
