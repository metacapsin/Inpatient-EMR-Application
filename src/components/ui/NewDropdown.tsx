import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

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
  id,
  options,
  value,
  placeholder = "Select option",
  onChange,
  disabled = false,
  className = "",
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

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div id={id} className={`w-full relative ${className}`.trim()} ref={dropdownRef}>
      {/* Selected Box */}

      <div
        className={`
  h-9
  border border-gray-300 rounded-md 
  px-2 
  bg-[#F6F6FA]
  flex justify-between items-center
  text-[#8B5E3C]
  transition-all duration-200
  ${disabled ? "cursor-not-allowed opacity-50 pointer-events-none" : "cursor-pointer hover:border-[#8B5E3C]"}
`}
        onClick={() => !disabled && setOpen(!open)}
        aria-disabled={disabled}
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
      {open && !disabled && (
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

