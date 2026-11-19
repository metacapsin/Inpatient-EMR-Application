import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ModuleErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    retrying?: boolean;
}

/**
 * Inline fetch-failure state for chart modules. Replaces toast-only errors so a failed load is never
 * mistaken for "no records" once the toast disappears.
 */
export function ModuleErrorState({ title = 'Could not load this section', message, onRetry, retrying = false }: ModuleErrorStateProps) {
    return (
        <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded-xl border border-red-200/80 bg-red-50 px-4 py-4 text-sm dark:border-red-900/40 dark:bg-red-950/30 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
                <div>
                    <p className="font-semibold text-red-950 dark:text-red-100">{title}</p>
                    <p className="mt-0.5 text-xs text-red-900/90 dark:text-red-200/90">{message}</p>
                </div>
            </div>
            {onRetry ? (
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={retrying}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-transparent dark:text-red-100 dark:hover:bg-red-900/30"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
                    Retry
                </button>
            ) : null}
        </div>
    );
}
