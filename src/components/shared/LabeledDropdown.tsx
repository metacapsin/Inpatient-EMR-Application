import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';

export interface LabeledDropdownOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface LabeledDropdownProps {
    id: string;
    label: string;
    value: string | undefined;
    placeholder: string;
    options: LabeledDropdownOption[];
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    'aria-busy'?: boolean;
}

export function LabeledDropdown({
    id,
    label,
    value,
    placeholder,
    options,
    onChange,
    disabled,
    className,
    'aria-busy': ariaBusy,
}: LabeledDropdownProps) {
    return (
        <div className={cn('space-y-2', className)}>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor={id}>
                {label}
            </label>
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger id={id} className="h-10 w-full min-w-0 shadow-sm" aria-busy={ariaBusy}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((o) => (
                        <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
