import { cn } from '../../lib/utils';

export interface DateRangePickerProps {
    label: string;
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

/** Native date inputs (yyyy-mm-dd); clears when empty. */
export function DateRangePicker({
    label,
    from,
    to,
    onFromChange,
    onToChange,
    className,
    disabled,
}: DateRangePickerProps) {
    const baseId = label.replace(/\s+/g, '-').toLowerCase();

    return (
        <div className={cn('min-w-0 flex-[1.25]', className)}>
            <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
            <div className="flex flex-wrap items-stretch gap-2">
                <div className="min-w-0 flex-1">
                    <label htmlFor={`${baseId}-from`} className="sr-only">
                        {label} from
                    </label>
                    <input
                        id={`${baseId}-from`}
                        type="date"
                        value={from}
                        disabled={disabled}
                        onChange={(e) => onFromChange(e.target.value)}
                        className="form-input w-full py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <label htmlFor={`${baseId}-to`} className="sr-only">
                        {label} to
                    </label>
                    <input
                        id={`${baseId}-to`}
                        type="date"
                        value={to}
                        min={from || undefined}
                        disabled={disabled}
                        onChange={(e) => onToChange(e.target.value)}
                        className="form-input w-full py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </div>
            </div>
        </div>
    );
}
