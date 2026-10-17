import { cn } from '../../../lib/utils';
import type { UnifiedOrderType } from '../../../types/unifiedOrders';

const TYPE_CLASS: Record<UnifiedOrderType, string> = {
    medication: 'bg-blue-100 text-blue-900 ring-blue-200/80 dark:bg-blue-950/45 dark:text-blue-100 dark:ring-blue-800/50',
    lab: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/45',
    radiology: 'bg-orange-100 text-orange-900 ring-orange-200/80 dark:bg-orange-950/40 dark:text-orange-100 dark:ring-orange-800/45',
    dietary: 'bg-yellow-100 text-yellow-900 ring-yellow-200/80 dark:bg-yellow-950/35 dark:text-yellow-100 dark:ring-yellow-800/40',
    therapy: 'bg-violet-100 text-violet-900 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/45',
    procedure: 'bg-gray-800 text-gray-50 ring-gray-700/80 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600/50',
};

const TYPE_LABEL: Record<UnifiedOrderType, string> = {
    medication: 'Medication',
    lab: 'Lab',
    radiology: 'Radiology',
    dietary: 'Dietary',
    therapy: 'Therapy',
    procedure: 'Procedure',
};

export function OrderTypeBadge({ orderType }: { orderType: UnifiedOrderType | string }) {
    const key = orderType as UnifiedOrderType;
    const tone = TYPE_CLASS[key] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    const label = TYPE_LABEL[key] ?? String(orderType);

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize leading-tight ring-1 ring-inset',
                tone
            )}
        >
            <span className="truncate">{label}</span>
        </span>
    );
}
