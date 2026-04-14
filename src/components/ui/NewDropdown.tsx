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
  border border-gray-300 rounded-md dark:border-gray-600
  px-2
  bg-[#F6F6FA] dark:bg-gray-900
  flex justify-between items-center
  text-[#8B5E3C] dark:text-amber-100/90
  transition-all duration-200
  ${disabled ? "cursor-not-allowed opacity-50 pointer-events-none" : "cursor-pointer hover:border-[#8B5E3C] dark:hover:border-amber-700"}
`}
        onClick={() => !disabled && setOpen(!open)}
        aria-disabled={disabled}
      >
        <span
          className={
            !selectedOption ? "text-gray-400 dark:text-gray-500" : "text-[#8B5E3C] dark:text-amber-100/90"
          }
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#8B5E3C] transition-transform duration-200 dark:text-amber-200/80 ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Dropdown menu */}
      {open && !disabled && (
        <div
          className="
            absolute top-full left-0 right-0 z-30 mt-2 max-h-60
            overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg
            dark:border-gray-700 dark:bg-gray-950
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
                cursor-pointer px-4 py-3 transition-colors
                ${
                  value === opt.value
                    ? "bg-[#E9E3DC] font-medium text-[#6B3F1F] dark:bg-gray-800 dark:text-amber-100"
                    : "text-gray-700 hover:bg-[#F3F1EE] dark:text-gray-200 dark:hover:bg-gray-800/80"
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

