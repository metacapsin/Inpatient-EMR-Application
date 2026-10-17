import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { UnifiedOrderRow } from '../../../types/unifiedOrders';
import {
    buildOrderSourceHref,
    SOURCE_MODULE_UNAVAILABLE_MESSAGE,
} from '../orderSourceRouting';

const SOURCE_BTN_BASE =
    'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold transition';

const SOURCE_BTN_ACTIVE =
    'border-primary-200/80 bg-primary-50/80 text-primary-900 hover:bg-primary-100/80 dark:border-primary-800/50 dark:bg-primary-950/30 dark:text-primary-100 dark:hover:bg-primary-900/40';

const SOURCE_BTN_UNAVAILABLE =
    'cursor-not-allowed border-gray-200/80 bg-gray-50/90 text-gray-400 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-gray-500';

type OrderSourceButtonProps = {
    row: UnifiedOrderRow;
};

export function OrderSourceButton({ row }: OrderSourceButtonProps) {
    const href = row.canOpenSource && row.deepLink ? buildOrderSourceHref(row.deepLink) : null;

    if (href) {
        return (
            <Link
                to={href}
                className={`${SOURCE_BTN_BASE} ${SOURCE_BTN_ACTIVE}`}
                title="Open source module"
            >
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                Source
            </Link>
        );
    }

    return (
        <button
            type="button"
            className={`${SOURCE_BTN_BASE} ${SOURCE_BTN_UNAVAILABLE}`}
            title={SOURCE_MODULE_UNAVAILABLE_MESSAGE}
            aria-disabled="true"
            onClick={() => toast.info(SOURCE_MODULE_UNAVAILABLE_MESSAGE)}
        >
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
            Source
        </button>
    );
}
