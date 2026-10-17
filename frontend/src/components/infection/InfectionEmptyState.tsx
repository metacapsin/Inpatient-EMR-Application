import { ShieldOff } from 'lucide-react';

export function InfectionEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200/90 bg-gray-50/50 px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <ShieldOff className="h-10 w-10 text-gray-300 dark:text-gray-600" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-200">No infection records found</p>
            <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                Add an infection record to track precautions, isolation, and monitoring status.
            </p>
        </div>
    );
}
