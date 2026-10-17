import { cn } from '../../../lib/utils';
import type { ConsentStatus } from '../../../types/consent';

const STYLES: Record<ConsentStatus, string> = {
    Signed: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30',
    Pending: 'bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-500/30',
    Revoked: 'bg-red-50 text-red-800 ring-red-600/20 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-500/30',
    Expired: 'bg-gray-100 text-gray-700 ring-gray-500/15 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-white/10',
};

export function ConsentStatusBadge({ status }: { status: ConsentStatus }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                STYLES[status],
            )}
        >
            {status}
        </span>
    );
}
