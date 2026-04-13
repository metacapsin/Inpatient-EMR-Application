import NewDropdown from '@/components/ui/NewDropdown';
import type { FacilityRoom, FacilityWard } from '../../types/facility';

export const BED_STATUS_FILTERS = [
    { value: '', label: 'All statuses' },
    { value: 'available', label: 'Available' },
    { value: 'occupied', label: 'Occupied' },
    { value: 'hold', label: 'Hold' },
    { value: 'maintenance', label: 'Maintenance' },
] as const;

export interface LiveBedBoardFiltersProps {
    wardId: string;
    roomId: string;
    bedStatus: string;
    wards: FacilityWard[];
    rooms: FacilityRoom[];
    wardsLoading: boolean;
    roomsLoading: boolean;
    onWardChange: (wardId: string) => void;
    onRoomChange: (roomId: string) => void;
    onBedStatusChange: (bedStatus: string) => void;
    disabled?: boolean;
}
export function LiveBedBoardFilters({
    wardId, roomId, bedStatus, wards, rooms, wardsLoading, roomsLoading, onWardChange, onRoomChange, onBedStatusChange, disabled,
}: LiveBedBoardFiltersProps) {
    const wardOptions = [
        { value: '__all__', label: 'All wards' },
        ...wards.map((w) => ({ value: w.id, label: w.name })),
    ];
    const roomOptions = [
        { value: '__all__', label: 'All rooms' },
        ...rooms.map((r) => ({ value: r.id, label: r.name })),
    ];

    return (
      <>
      <div className="grid grid-cols-3 gap-4 w-full">

    {/* WARD */}
    <div className="flex flex-col w-full">
        <label className="text-sm font-medium mb-1">Ward</label>
        <NewDropdown
            id="bed-board-ward"
            value={wardId ? wardId : '__all__'}
            placeholder={wardsLoading ? 'Loading wards…' : 'All wards'}
            options={wardOptions}
            onChange={(v) => onWardChange(v === '__all__' ? '' : String(v))}
            disabled={disabled || wardsLoading}
            aria-busy={wardsLoading}
            compact
            className="w-full min-w-0"
        />
    </div>

    {/* ROOM */}
    <div className="flex flex-col w-full">
        <label className="text-sm font-medium mb-1">Room</label>
        <NewDropdown
            id="bed-board-room"
            value={roomId ? roomId : '__all__'}
            placeholder={!wardId ? 'Select a ward to filter rooms' : roomsLoading ? 'Loading rooms…' : 'All rooms'}
            options={roomOptions}
            onChange={(v) => onRoomChange(v === '__all__' ? '' : String(v))}
            disabled={disabled || roomsLoading || !wardId}
            aria-busy={roomsLoading}
            compact
            className="w-full min-w-0"
        />
    </div>

    {/* BED STATUS */}
    <div className="flex flex-col w-full">
        <label className="text-sm font-medium mb-1">Bed Status</label>
        <NewDropdown
            id="bed-board-status"
            value={bedStatus || '__all__'}
            placeholder="All statuses"
            options={BED_STATUS_FILTERS.map((x) => ({
                value: x.value || '__all__',
                label: x.label
            }))}
            onChange={(v) => onBedStatusChange(v === '__all__' ? '' : String(v))}
            disabled={disabled}
            compact
            className="w-full min-w-0"
        />
    </div>

</div>
   
        </>
    );
}

