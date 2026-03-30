import type { ChangeEvent, Ref } from 'react';
import IconSearch from '../Icon/IconSearch';
import { cn } from '../../lib/utils';

export interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    id?: string;
    inputRef?: Ref<HTMLInputElement>;
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search…',
    className,
    disabled,
    id = 'patient-list-search',
    inputRef,
}: SearchInputProps) {
    return (
        <div className={cn('relative min-w-0 flex-1 sm:min-w-[200px]', className)}>
            <input
                ref={inputRef}
                id={id}
                type="search"
                value={value}
                disabled={disabled}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                className="form-input w-full pl-10"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <IconSearch className="h-4 w-4" />
            </span>
        </div>
    );
}
