import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { useRef } from 'react';

export type DateRange = { from: string; to: string };

export interface DateRangePickerProps {
  label: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  label,
  value,
  onChange,
  className,
  disabled,
}: DateRangePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Display format
  const formatDisplay = () => {
    if (!value.from && !value.to) return 'Select date range';

    try {
      const from = value.from ? format(new Date(value.from), 'dd MMM yyyy') : '';
      const to = value.to ? format(new Date(value.to), 'dd MMM yyyy') : '';
      return from && to ? `${from} - ${to}` : from || to;
    } catch {
      return 'Select date range';
    }
  };

  // ✅ Range logic
  const handleDateChange = (date: string) => {
    if (!value.from || (value.from && value.to)) {
      onChange({ from: date, to: '' });
    } else {
      if (date >= value.from) {
        onChange({ from: value.from, to: date });
      } else {
        onChange({ from: date, to: value.from });
      }
    }
  };

  // ✅ Click handler (important)
  const openPicker = () => {
    if (!inputRef.current) return;

    // modern browsers
    if ('showPicker' in inputRef.current) {
      (inputRef.current as any).showPicker();
    } else {
      // fallback
      (inputRef.current as HTMLInputElement).focus();
      (inputRef.current as HTMLInputElement).click();
    }
  };

  return (
    <div className={cn('min-w-[220px]', className)}>
      <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </span>

      <div className="relative">
        {/* Visible Input */}
        <input
          type="text"
          readOnly
          value={formatDisplay()}
          placeholder="Select date range"
          onClick={openPicker}
          className="form-input w-full py-2 text-sm cursor-pointer"
        />

        {/* Hidden but NOT overlay */}
        <input
          ref={inputRef}
          type="date"
          value={value.to || value.from}
          disabled={disabled}
          onChange={(e) => handleDateChange(e.target.value)}
          className="absolute left-0 top-0 opacity-0 pointer-events-none"
        />
      </div>
    </div>
  );
}