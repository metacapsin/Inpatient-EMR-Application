import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownOption {
  value: string | number;
  label: string;
}

type NewDropdownVariant = "default" | "outlined";

interface NewDropdownProps {
  id?: string;
  /** When `variant` is `outlined`, shown as a notched label on the field border (Reg. Date style). */
  label?: string;
  /** `outlined`: white field, border, notched label, 32px height (patient list filters). */
  variant?: NewDropdownVariant;
  /**
   * `sm` (default): 32px outlined fields (Patient List filters).
   * `md`: 40px outlined fields (appointment form) with neutral borders/typography.
   */
  fieldSize?: "sm" | "md";
  /** Highlights the trigger border when the field failed validation. */
  hasError?: boolean;
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
  label,
  variant = "outlined",
  fieldSize = "sm",
  hasError = false,
  options,
  value,
  placeholder = "Select option",
  onChange,
  disabled = false,
  className = "",
}: NewDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isOutlined = variant === "outlined";
  const isMdOutlined = isOutlined && fieldSize === "md";

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

  const triggerBase = disabled
    ? "cursor-not-allowed opacity-50 pointer-events-none"
    : "cursor-pointer";

  const triggerDefault = `
  h-9 max-h-9
  border border-gray-300 rounded-md dark:border-gray-600
  px-2
  bg-[#F6F6FA] dark:bg-gray-900
  ${!disabled ? "hover:border-[#8B5E3C] dark:hover:border-amber-700" : ""}
`;

  const triggerOutlinedSm = `
  h-8 max-h-[32px]
  rounded-lg border bg-white shadow-sm
  dark:bg-[#141210]
  px-2
  ${
    hasError
      ? "border-primary-600 dark:border-primary-500"
      : "border-primary-200 dark:border-primary-700"
  }
  ${!disabled && !hasError ? "hover:border-primary-300 dark:hover:border-primary-600" : ""}
`;

  const triggerOutlinedMd = `
  h-10 max-h-10
  rounded-lg border bg-white px-3
  outline-none transition-all duration-200
  focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15
  dark:bg-[#141210]
  ${
    hasError
      ? "border-primary-600 dark:border-primary-500"
      : "border-gray-200/70 dark:border-gray-600"
  }
  ${
    !disabled && !hasError
      ? "hover:border-gray-300/90 dark:hover:border-gray-500"
      : ""
  }
`;

  const triggerOutlined = isMdOutlined ? triggerOutlinedMd : triggerOutlinedSm;

  const triggerToneClass = isMdOutlined
    ? "text-gray-700 dark:text-gray-200"
    : "text-[#8B5E3C] dark:text-amber-100/90";

  const triggerClass = `
  w-full flex justify-between items-center gap-1 min-w-0
  ${triggerToneClass}
  transition-all duration-200
  ${triggerBase}
  ${isOutlined ? triggerOutlined : triggerDefault}
`.trim();

  const valueTextClass = isMdOutlined
    ? !selectedOption
      ? "text-gray-400 dark:text-gray-500"
      : "text-gray-900 dark:text-gray-100"
    : !selectedOption
      ? isOutlined
        ? "text-slate-400 dark:text-gray-500"
        : "text-gray-400 dark:text-gray-500"
      : isOutlined
        ? "text-slate-700 dark:text-gray-200"
        : "text-[#8B5E3C] dark:text-amber-100/90";

  const chevronClass = `shrink-0 transition-transform duration-200 ${
    isMdOutlined
      ? `text-gray-400 dark:text-gray-500 ${open ? "rotate-180" : ""} h-4 w-4`
      : `text-[#8B5E3C] dark:text-amber-200/80 ${open ? "rotate-180" : ""} ${
          isOutlined ? "h-3.5 w-3.5" : "h-4 w-4"
        }`
  }`;

  const valueTypography = isOutlined
    ? isMdOutlined
      ? "truncate text-left text-[14px] font-medium leading-tight"
      : "truncate text-left text-xs leading-tight"
    : "";

  const inner = (
    <>
      <button
        type="button"
        id={id}
        className={triggerClass}
        onClick={() => !disabled && setOpen(!open)}
        aria-disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={`min-w-0 flex-1 ${valueTextClass} ${valueTypography}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown className={chevronClass} aria-hidden />
      </button>

      {/* Dropdown menu */}
      {open && !disabled && (
        <div
          className={`
            absolute left-0 right-0 z-30 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg
            dark:border-gray-700 dark:bg-gray-950
            ${isOutlined ? "top-full mt-1" : "top-full mt-2"}
          `}
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
    </>
  );

  if (isOutlined && label) {
    return (
      <div className={`relative w-full ${className}`.trim()} ref={dropdownRef}>
        {inner}
        <span className="pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-white px-1 text-xs font-bold text-dark dark:bg-[#141210] dark:text-gray-200">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`.trim()} ref={dropdownRef}>
      {inner}
    </div>
  );
}

