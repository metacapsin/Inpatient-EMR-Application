import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import type { PatientListSortField } from '../../services/patient.service';

export interface SortableHeaderProps {
    children: ReactNode;
    isSortable?: boolean;
    sortKey?: PatientListSortField;
    activeSortKey?: PatientListSortField | null;
    sortOrder?: 'asc' | 'desc';
    onSort?: (key: PatientListSortField) => void;
    align?: 'left' | 'right' | 'center';
    className?: string;
    disabled?: boolean;
}

export function SortableHeader({
    children,
    isSortable = true,
    sortKey,
    activeSortKey = null,
    sortOrder = 'asc',
    onSort,
    align = 'left',
    className,
    disabled = false,
}: SortableHeaderProps) {
    const active = Boolean(isSortable && sortKey && activeSortKey === sortKey);
    const alignClass =
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

    const content = (
        <span className="inline-flex items-center gap-1.5">
            <span>{children}</span>
            {isSortable && (
                <span
                    className={cn(
                        'select-none text-xs font-normal tabular-nums',
                        active ? 'text-primary font-semibold' : 'text-gray-400'
                    )}
                    aria-hidden
                >
                    {active ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                </span>
            )}
        </span>
    );

    return (
        <th
            scope="col"
            className={cn(
                'px-4 py-3.5 text-xs font-semibold uppercase tracking-wide',
                active ? 'bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary-200' : 'text-gray-500',
                alignClass,
                className
            )}
        >
            {isSortable && sortKey ? (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSort?.(sortKey)}
                    className={cn(
                        '-mx-1 inline-flex w-full items-center rounded-md px-1 py-0.5 text-left hover:bg-gray-100/80 dark:hover:bg-white/5',
                        align === 'right' && 'justify-end text-right',
                        align === 'center' && 'justify-center text-center',
                        disabled && 'pointer-events-none cursor-default opacity-50 hover:bg-transparent'
                    )}
                >
                    {content}
                </button>
            ) : (
                content
            )}
        </th>
    );
}
