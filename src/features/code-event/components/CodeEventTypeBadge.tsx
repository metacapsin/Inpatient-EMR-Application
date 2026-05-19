import { cn } from '../../../lib/utils';
import type { CodeEventType } from '../../../types/codeEvent';

const TONE: Record<string, string> = {
    'Code Blue': 'bg-red-100 text-red-900 ring-red-300/40 dark:bg-red-950/60 dark:text-red-100 dark:ring-red-800/50',
    'Rapid Response': 'bg-amber-100 text-amber-950 ring-amber-300/40 dark:bg-amber-950/50 dark:text-amber-100',
    'Code Stroke': 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100',
    'Code STEMI': 'bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100',
    'Code Sepsis': 'bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100',
    'Code OB': 'bg-pink-100 text-pink-900 dark:bg-pink-950/50 dark:text-pink-100',
};

export function CodeEventTypeBadge({ eventType, className }: { eventType: CodeEventType | string; className?: string }) {
    const tone = TONE[eventType] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset',
                tone,
                className
            )}
        >
            {eventType}
        </span>
    );
}
