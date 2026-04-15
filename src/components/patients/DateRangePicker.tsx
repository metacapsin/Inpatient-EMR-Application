import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { useId, useRef } from 'react';

export type DateRange = { from: string; to: string };

export interface DateRangePickerProps {
  label: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  disabled?: boolean;
}

function formatRangeDisplay(value: DateRange): string {
  if (!value.from && !value.to) return '';

  const fmt = (raw: string) => format(new Date(raw), 'MM/dd/yy');

  try {
    if (value.from && value.to) return `${fmt(value.from)} - ${fmt(value.to)}`;
    if (value.from) return `${fmt(value.from)} - `;
    return '';
  } catch {
    return '';
  }
}

export function DateRangePicker({
  label,
  value,
  onChange,
  className,
  disabled,
}: DateRangePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const id = useId();
  const display = formatRangeDisplay(value);

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

  const openPicker = () => {
    if (disabled || !inputRef.current) return;

    const el = inputRef.current;
    const withPicker = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === 'function') {
      withPicker.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

  return (
    <div className={cn('relative min-w-[260px]', className)}>
      <div
        className={cn(
          'flex h-8 max-h-[32px] overflow-hidden rounded-lg border border-primary-200 bg-white shadow-sm',
          'dark:border-primary-700 dark:bg-[#141210]',
          disabled && 'pointer-events-none opacity-60'
        )}
      >
        <input
          id={id}
          type="text"
          readOnly
          value={display}
          placeholder="MM/DD/YY - MM/DD/YY "
          onClick={openPicker}
          className={cn(
            'h-8 min-h-0 max-h-[32px] flex-1 cursor-pointer border-0 bg-transparent py-0 pl-2.5 pr-1.5 text-xs outline-none ring-0',
            'placeholder:text-slate-400 dark:placeholder:text-gray-500',
            display ? 'text-slate-700 dark:text-gray-200' : 'text-slate-500 dark:text-gray-400 w-full'
          )}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            openPicker();
          }}
          className={cn(
            'flex h-8 max-h-[32px] w-8 shrink-0 items-center justify-center bg-primary px-0 text-white transition-colors',
            'hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-700',
            'disabled:cursor-not-allowed disabled:opacity-60'
          )}
          aria-label="Open date range calendar"
        >
          <Calendar className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      </div>
    

      <label
        htmlFor={id}
        className={cn(
          'absolute left-3 top-0 z-10 -translate-y-1/2 cursor-pointer bg-white px-1 text-xs font-bold text-dark',
          'dark:bg-[#141210] dark:text-gray-200'
        )}
      >
        {label}
      </label>

      <input
        ref={inputRef}
        type="date"
        value={value.to || value.from}
        disabled={disabled}
        onChange={(e) => handleDateChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}
