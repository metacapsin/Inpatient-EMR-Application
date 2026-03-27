import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Search, X, ChevronDownIcon } from "lucide-react";
import { Select, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  triggerClassName?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** When "top", dropdown opens above the trigger. Default "bottom". */
  side?: "top" | "bottom";
}

const triggerBaseClasses =
  "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-white dark:bg-[#1a2332] hover:bg-gray-50 dark:hover:bg-[#1f2a3a] flex items-center justify-between gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm whitespace-nowrap shadow-sm transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  triggerClassName,
  searchPlaceholder = "Search...",
  disabled = false,
  side = "bottom",
}: SearchableSelectProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const filteredOptions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    const filtered = options.filter((o) => o.label.toLowerCase().includes(q));
    const selectedOpt = value ? options.find((o) => o.value === value) : null;
    if (selectedOpt && !filtered.some((o) => o.value === value)) {
      return [selectedOpt, ...filtered];
    }
    return filtered;
  }, [options, searchQuery, value]);

  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onValueChange("");
    setOpen(false);
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) setSearchQuery("");
  };

  const selectValue = value === "" || value == null ? undefined : value;
  const hasValue = Boolean(value);

  return (
    <div className="relative">
      <Select
        key={hasValue ? "has-value" : "empty"}
        value={selectValue}
        onValueChange={(v) => onValueChange(v ?? "")}
        onOpenChange={handleOpenChange}
        open={open}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          className={cn(
            triggerBaseClasses,
            "w-full",
            hasValue && "pr-8",
            triggerClassName
          )}
          data-slot="select-trigger"
          data-size="default"
        >
          <span className="min-w-0 flex-1 flex items-center">
            <SelectValue placeholder={placeholder} />
          </span>
          <ChevronDownIcon className="size-4 opacity-50 shrink-0" aria-hidden />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            "bg-white dark:bg-[#1a2332] text-gray-900 dark:text-gray-100 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-[60] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] origin-(--radix-select-content-transform-origin) overflow-hidden rounded-md border border-gray-300 dark:border-gray-600 shadow-lg",
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
          )}
          position="popper"
          side={side}
          sideOffset={4}
        >
          {/* Search field at top - border and icon match project primary theme */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#1f2a3a] sticky top-0">
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="h-9 pr-9 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a2332] text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-primary/50 focus-visible:border-primary/50"
              />
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
            </div>
          </div>
          <SelectPrimitive.Viewport
            className={cn(
              "p-1 max-h-60 overflow-y-auto overflow-x-hidden",
              "w-full min-w-0 max-w-[var(--radix-select-trigger-width)]"
            )}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))
            ) : (
              <div className="py-6 px-3 text-center text-sm text-muted-foreground pointer-events-none">
                No results found.
              </div>
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </Select>
    {hasValue && !disabled && (
      <button
        type="button"
        onClick={handleClearClick}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 shrink-0 rounded p-0.5 text-gray-500 hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label="Clear selection"
      >
        <X className="size-4" />
      </button>
    )}
  </div>
  );
}
