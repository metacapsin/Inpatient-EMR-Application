import { Sparkles } from 'lucide-react';

export function EVSEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200/80 bg-gray-50/50 px-6 py-16 text-center dark:border-white/[0.08] dark:bg-white/[0.02]">
            <Sparkles className="mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No beds in the EVS queue</h3>
            <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                Discharged beds awaiting environmental services will appear here. Data is mock-backed until EVS APIs are
                connected.
            </p>
        </div>
    );
}
