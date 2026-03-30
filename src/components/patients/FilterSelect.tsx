import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface FilterSelectOption {
    value: string;
    label: string;
}

export interface FilterSelectProps {
    /** Omit or pass null to hide the label row (e.g. top bar). */
    label?: ReactNode;
    value: string;
    onChange: (value: string) => void;
    options: FilterSelectOption[];
    id?: string;
    className?: string;
    disabled?: boolean;
}

export function FilterSelect({ label, value, onChange, options, id, className, disabled }: FilterSelectProps) {
    const autoId = useId();
    const selectId = id ?? autoId;

    return (
        <div className={cn('min-w-0 flex-1', className)}>
            {label != null && label !== '' && (
                <label
                    htmlFor={selectId}
                    className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400"
                >
                    {label}
                </label>
            )}
            <select
                id={selectId}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="form-input w-full cursor-pointer py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
