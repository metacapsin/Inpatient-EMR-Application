import { useQuery } from '@tanstack/react-query';
import type { PatientLocationSnapshot } from '../../../types/patientLocation';
import {
    fetchBedOptionsForRoom,
    fetchRoomOptionsForWard,
    fetchWardOptions,
} from '../../../services/patientLocation.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { cn } from '../../../lib/utils';

export interface LocationCascadeSelectsProps {
    patientId: string;
    value: PatientLocationSnapshot;
    onChange: (next: PatientLocationSnapshot) => void;
    disabled?: boolean;
    className?: string;
}

export function LocationCascadeSelects({
    patientId,
    value,
    onChange,
    disabled = false,
    className,
}: LocationCascadeSelectsProps) {
    const wardsQuery = useQuery({
        queryKey: ['facility', 'wards'],
        queryFn: fetchWardOptions,
    });

    const roomsQuery = useQuery({
        queryKey: ['facility', 'rooms', value.wardId],
        queryFn: () => fetchRoomOptionsForWard(value.wardId),
        enabled: Boolean(value.wardId.trim()),
    });

    const bedsQuery = useQuery({
        queryKey: ['facility', 'beds', value.roomId, patientId],
        queryFn: () => fetchBedOptionsForRoom(value.roomId, patientId),
        enabled: Boolean(value.roomId.trim()),
    });

    const loadError = wardsQuery.error || roomsQuery.error || bedsQuery.error;
    const errorMessage =
        loadError instanceof Error ? loadError.message : loadError ? 'Failed to load location data' : null;

    const wardLocked = disabled || wardsQuery.isLoading;
    const roomLocked = disabled || roomsQuery.isLoading || !value.wardId.trim();
    const bedLocked = disabled || bedsQuery.isLoading || !value.roomId.trim();

    const onWardChange = (wardId: string) => {
        const w = wardsQuery.data?.find((x) => x.id === wardId);
        onChange({
            wardId,
            wardName: w?.name ?? '',
            roomId: '',
            roomName: '',
            bedId: '',
            bedName: '',
        });
    };

    const onRoomChange = (roomId: string) => {
        const r = roomsQuery.data?.find((x) => x.id === roomId);
        onChange({
            ...value,
            roomId,
            roomName: r?.name ?? '',
            bedId: '',
            bedName: '',
        });
    };

    const onBedChange = (bedId: string) => {
        const b = bedsQuery.data?.find((x) => x.id === bedId);
        onChange({
            ...value,
            bedId,
            bedName: b?.label ?? '',
        });
    };

    const roomsEmpty = Boolean(value.wardId.trim()) && !roomsQuery.isLoading && (roomsQuery.data?.length ?? 0) === 0;
    const bedsEmpty = Boolean(value.roomId.trim()) && !bedsQuery.isLoading && (bedsQuery.data?.length ?? 0) === 0;

    return (
        <div className={cn('space-y-4', className)}>
            {errorMessage ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
                    {errorMessage}
                </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="loc-ward">
                        Ward / unit
                    </label>
                    <Select
                        value={value.wardId.trim() ? value.wardId : undefined}
                        onValueChange={onWardChange}
                        disabled={wardLocked}
                    >
                        <SelectTrigger id="loc-ward" className="h-10 w-full min-w-0 shadow-sm" aria-busy={wardsQuery.isLoading}>
                            <SelectValue placeholder={wardsQuery.isLoading ? 'Loading wards…' : 'Select ward'} />
                        </SelectTrigger>
                        <SelectContent>
                            {(wardsQuery.data ?? []).map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                    {w.name} ({w.code})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="loc-room">
                        Room
                    </label>
                    <Select
                        value={value.roomId.trim() ? value.roomId : undefined}
                        onValueChange={onRoomChange}
                        disabled={roomLocked}
                    >
                        <SelectTrigger id="loc-room" className="h-10 w-full min-w-0 shadow-sm" aria-busy={roomsQuery.isLoading}>
                            <SelectValue
                                placeholder={
                                    !value.wardId.trim()
                                        ? 'Choose a ward first'
                                        : roomsQuery.isLoading
                                          ? 'Loading rooms…'
                                          : 'Select room'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {(roomsQuery.data ?? []).map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                    {r.name} ({r.number})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {roomsEmpty ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No rooms available for this ward.</p>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="loc-bed">
                        Bed
                    </label>
                    <Select
                        value={value.bedId.trim() ? value.bedId : undefined}
                        onValueChange={onBedChange}
                        disabled={bedLocked}
                    >
                        <SelectTrigger id="loc-bed" className="h-10 w-full min-w-0 shadow-sm" aria-busy={bedsQuery.isLoading}>
                            <SelectValue
                                placeholder={
                                    !value.roomId.trim()
                                        ? 'Choose a room first'
                                        : bedsQuery.isLoading
                                          ? 'Loading beds…'
                                          : 'Select bed'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {(bedsQuery.data ?? []).map((b) => (
                                <SelectItem key={b.id} value={b.id} disabled={!b.selectable}>
                                    {b.label}
                                    {b.occupied && !b.selectable ? ' (occupied)' : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {bedsEmpty ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No beds available for this room.</p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
