import * as React from 'react';
import { forwardRef, useId, useRef, useImperativeHandle } from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OutlinedDateInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
    'data-slot'?: string;
};

/**
 * Single-date control matching {@link DateRangePicker} (32px row, border, calendar affordance).
 * Native `type="date"` is visually hidden; value should be `yyyy-MM-dd` or empty when controlled.
 */
export const OutlinedDateInput = forwardRef<HTMLInputElement, OutlinedDateInputProps>(
    function OutlinedDateInput(
        { className, id, value, disabled, onChange, onBlur, onFocus, name, min, max, required, readOnly, 'data-slot': dataSlot, ...nativeProps },
        ref
    ) {
        const autoId = useId();
        const displayId = id ?? `outlined-date-${autoId}`;
        const hiddenRef = useRef<HTMLInputElement>(null);

        useImperativeHandle(ref, () => hiddenRef.current as HTMLInputElement, []);

        const strVal = value === undefined || value === null ? '' : String(value);

        let display = '';
        if (strVal) {
            try {
                display = format(new Date(strVal), 'MM/dd/yy');
            } catch {
                display = strVal;
            }
        }

        const openPicker = () => {
            if (disabled || readOnly || !hiddenRef.current) return;
            const el = hiddenRef.current;
            const withPicker = el as HTMLInputElement & { showPicker?: () => void };
            if (typeof withPicker.showPicker === 'function') {
                withPicker.showPicker();
            } else {
                el.focus();
                el.click();
            }
        };

        return (
            <div
                data-slot={dataSlot}
                className={cn('relative w-full min-w-[7.5rem]', className, 'h-8 max-h-[32px]')}
            >
                <div
                    className={cn(
                        'flex h-8 max-h-[32px] w-full overflow-hidden rounded-lg border border-primary-200 bg-white shadow-sm',
                        'dark:border-primary-700 dark:bg-[#141210]',
                        disabled && 'pointer-events-none opacity-60'
                    )}
                >
                    <input
                        id={displayId}
                        type="text"
                        readOnly
                        value={display}
                        placeholder="MM/DD/YY"
                        onClick={openPicker}
                        aria-haspopup="dialog"
                        className={cn(
                            'h-8 min-h-0 max-h-[32px] min-w-0 flex-1 cursor-pointer border-0 bg-transparent py-0 pl-2.5 pr-1.5 text-xs outline-none ring-0',
                            'placeholder:text-slate-400 dark:placeholder:text-gray-500',
                            display ? 'text-slate-700 dark:text-gray-200' : 'text-slate-500 dark:text-gray-400'
                        )}
                    />
                    <button
                        type="button"
                        disabled={disabled || readOnly}
                        onClick={(e) => {
                            e.preventDefault();
                            openPicker();
                        }}
                        className={cn(
                            'flex h-8 max-h-[32px] w-8 shrink-0 items-center justify-center bg-primary px-0 text-white transition-colors',
                            'hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-700',
                            'disabled:cursor-not-allowed disabled:opacity-60'
                        )}
                        aria-label="Open calendar"
                        tabIndex={-1}
                    >
                        <Calendar className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </button>
                </div>

                <input
                    ref={hiddenRef}
                    {...nativeProps}
                    type="date"
                    name={name}
                    value={strVal}
                    onChange={onChange}
                    onBlur={onBlur}
                    onFocus={onFocus}
                    disabled={disabled}
                    readOnly={readOnly}
                    min={min}
                    max={max}
                    required={required}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                />
            </div>
        );
    }
);

OutlinedDateInput.displayName = 'OutlinedDateInput';
