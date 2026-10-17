import type { ReactNode } from 'react';
import { Siren } from 'lucide-react';

type Props = {
    title: string;
    description?: string;
    action?: ReactNode;
};

export function CodeEventEmptyState({ title, description, action }: Props) {
    return (
        <div
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.02]"
            role="status"
        >
            <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                aria-hidden
            >
                <Siren className="h-6 w-6" strokeWidth={2} />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
            {description ? <p className="mt-1 max-w-md text-xs text-gray-500 dark:text-gray-400">{description}</p> : null}
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}
