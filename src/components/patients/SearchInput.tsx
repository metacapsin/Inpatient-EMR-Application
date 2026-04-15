import type { ChangeEvent, Ref } from 'react';
import { Search } from 'lucide-react';
import IconSearch from '../Icon/IconSearch';
import { cn } from '../../lib/utils';

export interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    /** Matches Appointment List search field (height, radius, borders, focus ring). */
    variant?: 'default' | 'premium';
    disabled?: boolean;
    id?: string;
    inputRef?: Ref<HTMLInputElement>;
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search…',
    className,
    variant = 'default',
    disabled,
    id = 'patient-list-search',
    inputRef,
}: SearchInputProps) {
    const isPremium = variant === 'premium';

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
                className={cn(
                    'w-full',
                    isPremium
                        ? 'rounded-lg border border-gray-200/80 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary/15 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600'
                        : 'form-input pl-10'
                )}
            />
            <span
                className={cn(
                    'pointer-events-none absolute text-gray-400 dark:text-gray-500',
                    isPremium ? 'inset-y-0 left-0 flex items-center pl-3' : 'left-3 top-1/2 -translate-y-1/2'
                )}
            >
                {isPremium ? <Search className="h-4 w-4" aria-hidden /> : <IconSearch className="h-4 w-4" />}
            </span>
        </div>
    );
}
