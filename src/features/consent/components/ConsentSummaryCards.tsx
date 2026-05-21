import { AlertTriangle, CheckCircle2, Clock, FileX2, ShieldOff } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ConsentSummaryCounts } from '../../../types/consent';
import { CONSENT_SECTION_CARD_CLASS } from '../constants/consentLayout';

type CardDef = {
    key: keyof ConsentSummaryCounts;
    label: string;
    icon: typeof CheckCircle2;
    accent: string;
};

const CARDS: CardDef[] = [
    { key: 'signed', label: 'Signed', icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'pending', label: 'Pending', icon: Clock, accent: 'text-amber-600 dark:text-amber-400' },
    { key: 'revoked', label: 'Revoked', icon: ShieldOff, accent: 'text-red-600 dark:text-red-400' },
    { key: 'expired', label: 'Expired', icon: FileX2, accent: 'text-gray-500 dark:text-gray-400' },
    { key: 'missingRequired', label: 'Missing Required', icon: AlertTriangle, accent: 'text-orange-600 dark:text-orange-400' },
];

type Props = {
    counts: ConsentSummaryCounts;
    loading?: boolean;
};

export function ConsentSummaryCards({ counts, loading }: Props) {
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3">
            {CARDS.map(({ key, label, icon: Icon, accent }) => (
                <div
                    key={key}
                    className={cn(
                        CONSENT_SECTION_CARD_CLASS,
                        'p-3 transition-shadow hover:shadow-md',
                        loading && 'animate-pulse',
                    )}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {label}
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-50">
                                {loading ? '—' : counts[key]}
                            </p>
                        </div>
                        <Icon className={cn('h-5 w-5 shrink-0 opacity-80', accent)} aria-hidden />
                    </div>
                </div>
            ))}
        </div>
    );
}
