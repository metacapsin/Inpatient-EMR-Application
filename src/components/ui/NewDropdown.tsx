import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { LiveBedBoardFiltersProps, BED_STATUS_FILTERS } from "@/modules/bed-board/LiveBedBoardFilters";
// import { LabeledDropdown } from "../shared/LabeledDropdown";


interface DropdownOption {
  value: string | number;
  label: string;
}

interface NewDropdownProps {
  id?: string;
  label?: string;
  options: DropdownOption[];
  value: string | number;
  placeholder?: string;
  onChange: (value: string | number) => void;
  disabled?: boolean;
  "aria-busy"?: boolean;
  compact?: boolean;
  className?: string;
}

export default function NewDropdown({
  options,
  value,
  placeholder = "Select option",
  onChange,
}: NewDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // close when click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);  
  {options.map((opt) => (
  <div
    key={opt.value}
    onClick={() => {
      onChange(opt.value);
      setOpen(false);
    }}
    className={`
      px-4 py-3 cursor-pointer transition-all

      ${
        value === opt.value
          ? "bg-[#E9E3DC] text-[#6B3F1F] font-medium"  // ← SELECTED (darker)
          : "text-gray-700 hover:bg-[#F3F1EE]"         // ← NORMAL
      }
    `}
  >
    {opt.label}
  </div>
  
))}

  return (
    <div className="w-full relative" ref={dropdownRef}>
      {/* Selected Box */}

      <div
className="
  h-9
  border border-gray-300 rounded-md 
  px-2 
  bg-[#F6F6FA]
  cursor-pointer flex justify-between items-center
  text-[#8B5E3C]
  hover:border-[#8B5E3C]
  transition-all duration-200
"
  onClick={() => setOpen(!open)}
>
  <span className={!selectedOption ? "text-gray-400" : "text-[#8B5E3C]"}>
    {selectedOption ? selectedOption.label : placeholder}
  </span>

  <ChevronDown
    className={`h-4 w-4 text-[#8B5E3C] transition-transform duration-200 ${
      open ? "rotate-180" : ""
    }`}
  />
</div>

      {/* Dropdown menu */}
      {open && (
        <div
          className="
            absolute top-full left-0 right-0 mt-2 
            bg-white border rounded-xl shadow-lg z-30
            max-h-60 overflow-y-auto
          "
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
                 className={`
      px-4 py-3 cursor-pointer transition-all

      ${
        value === opt.value
          ? "bg-[#E9E3DC] text-[#6B3F1F] font-medium"  // ← SELECTED (darker)
          : "text-gray-700 hover:bg-[#F3F1EE]"         // ← NORMAL
      }
    `}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
