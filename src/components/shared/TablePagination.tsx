import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

export type TablePaginationProps = {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: readonly number[];
    loading?: boolean;
    itemLabel?: string;
    className?: string;
};

export function TablePagination({
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    loading = false,
    itemLabel = 'records',
    className,
}: TablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, totalItems);

    return (
        <div
            className={cn(
                'flex shrink-0 flex-col gap-2 border-t border-gray-200/70 bg-white px-4 py-2 dark:border-white/[0.06] dark:bg-[#141210] sm:flex-row sm:items-center sm:justify-between',
                className
            )}
        >
            <p className="text-xs text-gray-600 dark:text-gray-400">
                {totalItems === 0 ? (
                    <>0 {itemLabel}</>
                ) : (
                    <>
                        Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>–
                        <span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{totalItems}</span> {itemLabel}
                    </>
                )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
                {onPageSizeChange ? (
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <span>Rows</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            disabled={loading}
                            className="h-8 rounded-md border border-gray-200/80 bg-white px-2 text-xs dark:border-white/[0.08] dark:bg-[#1a1816] disabled:opacity-60"
                        >
                            {pageSizeOptions.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}

                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        title="Previous page"
                        disabled={page <= 1 || loading || totalItems === 0}
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200/80 bg-white text-gray-700 transition hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <span className="min-w-[5.5rem] text-center text-xs tabular-nums text-gray-600 dark:text-gray-400">
                        Page {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        title="Next page"
                        disabled={page >= totalPages || loading || totalItems === 0}
                        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200/80 bg-white text-gray-700 transition hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                    >
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                </div>
            </div>
        </div>
    );
}
