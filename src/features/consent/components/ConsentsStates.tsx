import { FileSignature, RefreshCw } from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';

export function ConsentsEmptyState({ onObtain }: { onObtain: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50/80 to-white px-6 py-14 text-center dark:border-white/10 dark:from-white/[0.02] dark:to-transparent">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary">
                <FileSignature className="h-7 w-7" strokeWidth={1.75} aria-hidden />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No consents on file</h3>
            <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
                Obtain and sign required consents for this encounter. General Treatment and HIPAA NPP are required for
                discharge readiness.
            </p>
            <AppButton className="mt-6" onClick={onObtain}>
                Obtain consent
            </AppButton>
        </div>
    );
}

export function ConsentsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div
            className="rounded-xl border border-red-200 bg-red-50/80 px-5 py-8 text-center dark:border-red-900/50 dark:bg-red-950/30"
            role="alert"
        >
            <p className="text-sm font-semibold text-red-900 dark:text-red-100">Unable to load consents</p>
            <p className="mt-1 text-sm text-red-800/90 dark:text-red-200/90">{message}</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900 transition hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900/40"
            >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Retry
            </button>
        </div>
    );
}
