import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  NOTCHED_COMPACT_LABEL_OVERLAY_CLASS,
  NOTCHED_FIELD_LABEL_OVERLAY_CLASS,
} from "../../lib/notchedFieldLabels";

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
   * `md`: 32px outlined fields (flowsheet) with neutral borders/typography.
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
  /**
   * Render the option list in `document.body` with fixed positioning so it is not clipped by
   * `overflow: auto/hidden` ancestors (e.g. nursing flowsheet scroll + accordion).
   */
  appendMenuToBody?: boolean;
  /** When set with `label` omitted, associates the trigger with an external label (e.g. flowsheet above-field labels). */
  ariaLabelledBy?: string;
}

const MENU_CLASSES =
  "max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-950 dark:shadow-black/40";

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
  appendMenuToBody = false,
  ariaLabelledBy,
}: NewDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const isOutlined = variant === "outlined";
  const isMdOutlined = isOutlined && fieldSize === "md";

  const selectedOption = options.find((opt) => opt.value === value);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 160),
    });
  };

  useLayoutEffect(() => {
    if (!open || !appendMenuToBody || disabled) {
      setMenuBox(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, appendMenuToBody, disabled]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t)) return;
      if (appendMenuToBody && menuPortalRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, appendMenuToBody]);

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
  h-8 max-h-[32px]
  rounded-lg border bg-white px-2.5
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
      ? "text-gray-500 dark:text-gray-400"
      : "text-gray-900 dark:text-gray-100"
    : !selectedOption
      ? isOutlined
        ? "text-slate-400 dark:text-gray-500"
        : "text-gray-400 dark:text-gray-500"
      : isOutlined
        ? "text-slate-700 dark:text-gray-200"
        : "text-[#8B5E3C] dark:text-amber-100/90";

  const chevronClass = `shrink-0 self-center transition-transform duration-200 ${
    isMdOutlined
      ? `text-gray-400 dark:text-gray-500 ${open ? "rotate-180" : ""} h-4 w-4`
      : `text-[#8B5E3C] dark:text-amber-200/80 ${open ? "rotate-180" : ""} ${
          isOutlined ? "h-3.5 w-3.5" : "h-4 w-4"
        }`
  }`;

  const valueTypography = isOutlined
    ? isMdOutlined
      ? "truncate text-left text-xs font-medium leading-none"
      : "truncate text-left text-xs leading-tight"
    : "";

  const notchedLabelClass = isMdOutlined
    ? NOTCHED_FIELD_LABEL_OVERLAY_CLASS
    : NOTCHED_COMPACT_LABEL_OVERLAY_CLASS;

  const renderMenu = (mode: "inline" | "portal") => (
    <div
      ref={mode === "portal" ? menuPortalRef : undefined}
      className={
        mode === "inline"
          ? `absolute left-0 right-0 z-[12000] ${isOutlined ? "top-full mt-1" : "top-full mt-2"} ${MENU_CLASSES}`
          : MENU_CLASSES
      }
      style={
        mode === "portal" && menuBox
          ? {
              position: "fixed",
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
              zIndex: 12000,
            }
          : undefined
      }
      role="listbox"
    >
      {options.map((opt) => (
        <div
          key={String(opt.value)}
          role="option"
          aria-selected={value === opt.value}
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
  );

  const inner = (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-labelledby={ariaLabelledBy}
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

      {open && !disabled && !appendMenuToBody ? renderMenu("inline") : null}
    </>
  );

  const portalMenu =
    open && !disabled && appendMenuToBody && menuBox && typeof document !== "undefined"
      ? createPortal(renderMenu("portal"), document.body)
      : null;

  if (isOutlined && label) {
    return (
      <>
        <div className={`relative isolate w-full ${className}`.trim()} ref={dropdownRef}>
          {inner}
          <span className={notchedLabelClass}>{label}</span>
        </div>
        {portalMenu}
      </>
    );
  }

  return (
    <>
      <div className={`relative w-full ${className}`.trim()} ref={dropdownRef}>
        {inner}
      </div>
      {portalMenu}
    </>
  );
}
