import { useEffect, useState } from 'react';
import type { PatientLocationSnapshot } from '../../types/patientLocation';
import {
    fetchBedOptionsForRoom,
    fetchRoomOptionsForWard,
    fetchWardOptions,
    type BedOption,
    type RoomOption,
    type WardOption,
} from '../../services/patientLocation.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';

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
    const [wards, setWards] = useState<WardOption[]>([]);
    const [rooms, setRooms] = useState<RoomOption[]>([]);
    const [beds, setBeds] = useState<BedOption[]>([]);
    const [loadingWards, setLoadingWards] = useState(true);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [loadingBeds, setLoadingBeds] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoadingWards(true);
        setError(null);
        fetchWardOptions()
            .then((list) => {
                if (!cancelled) setWards(list);
            })
            .catch((e: unknown) => {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load wards');
            })
            .finally(() => {
                if (!cancelled) setLoadingWards(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!value.wardId.trim()) {
            setRooms([]);
            return;
        }
        let cancelled = false;
        setLoadingRooms(true);
        fetchRoomOptionsForWard(value.wardId)
            .then((list) => {
                if (!cancelled) setRooms(list);
            })
            .catch((e: unknown) => {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load rooms');
            })
            .finally(() => {
                if (!cancelled) setLoadingRooms(false);
            });
        return () => {
            cancelled = true;
        };
    }, [value.wardId]);

    useEffect(() => {
        if (!value.roomId.trim()) {
            setBeds([]);
            return;
        }
        let cancelled = false;
        setLoadingBeds(true);
        fetchBedOptionsForRoom(value.roomId, patientId)
            .then((list) => {
                if (!cancelled) setBeds(list);
            })
            .catch((e: unknown) => {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load beds');
            })
            .finally(() => {
                if (!cancelled) setLoadingBeds(false);
            });
        return () => {
            cancelled = true;
        };
    }, [value.roomId, patientId]);

    const wardLocked = disabled || loadingWards;
    const roomLocked = disabled || loadingRooms || !value.wardId.trim();
    const bedLocked = disabled || loadingBeds || !value.roomId.trim();

    const onWardChange = (wardId: string) => {
        const w = wards.find((x) => x.id === wardId);
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
        const r = rooms.find((x) => x.id === roomId);
        onChange({
            ...value,
            roomId,
            roomName: r?.name ?? '',
            bedId: '',
            bedName: '',
        });
    };

    const onBedChange = (bedId: string) => {
        const b = beds.find((x) => x.id === bedId);
        onChange({
            ...value,
            bedId,
            bedName: b?.label ?? '',
        });
    };

    return (
        <div className={cn('space-y-4', className)}>
            {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
                    {error}
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
                        <SelectTrigger id="loc-ward" className="h-10 w-full min-w-0 shadow-sm" aria-busy={loadingWards}>
                            <SelectValue placeholder={loadingWards ? 'Loading wards…' : 'Select ward'} />
                        </SelectTrigger>
                        <SelectContent>
                            {wards.map((w) => (
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
                        <SelectTrigger id="loc-room" className="h-10 w-full min-w-0 shadow-sm" aria-busy={loadingRooms}>
                            <SelectValue
                                placeholder={
                                    !value.wardId.trim()
                                        ? 'Choose a ward first'
                                        : loadingRooms
                                          ? 'Loading rooms…'
                                          : 'Select room'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {rooms.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                    {r.name} ({r.number})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                        <SelectTrigger id="loc-bed" className="h-10 w-full min-w-0 shadow-sm" aria-busy={loadingBeds}>
                            <SelectValue
                                placeholder={
                                    !value.roomId.trim()
                                        ? 'Choose a room first'
                                        : loadingBeds
                                          ? 'Loading beds…'
                                          : 'Select bed'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {beds.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                    {b.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
