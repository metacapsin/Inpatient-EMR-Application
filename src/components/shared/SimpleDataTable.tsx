import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface SimpleDataTableColumn<T> {
    key: string;
    header: string;
    className?: string;
    render: (row: T) => ReactNode;
}

export interface SimpleDataTableProps<T> {
    columns: SimpleDataTableColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    emptyMessage?: string;
    className?: string;
}

export function SimpleDataTable<T>({ columns, rows, rowKey, emptyMessage, className }: SimpleDataTableProps<T>) {
    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-12 text-center text-sm text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
                {emptyMessage ?? 'No records'}
            </div>
        );
    }

    return (
        <div className={cn('overflow-hidden rounded-xl border border-gray-200 dark:border-white/10', className)}>
            <div className="max-h-[min(60vh,480px)] overflow-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-gray-800/90">
                        <tr>
                            {columns.map((c) => (
                                <th
                                    key={c.key}
                                    scope="col"
                                    className={cn('px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400', c.className)}
                                >
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                        {rows.map((row) => (
                            <tr key={rowKey(row)} className="bg-white dark:bg-[#141210]">
                                {columns.map((c) => (
                                    <td key={c.key} className={cn('px-4 py-3 text-gray-800 dark:text-gray-200', c.className)}>
                                        {c.render(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
