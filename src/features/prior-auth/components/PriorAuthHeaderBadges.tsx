import { useMemo } from 'react';
import type { PriorAuthRecord } from '../types/priorAuth.types';
import { daysUntilEnd, parseAuthDate } from '../Prior/priorAuthDates';

type Props = {
    records: PriorAuthRecord[];
};

type BadgeKey = 'approved' | 'pending' | 'denied' | 'expiring';

const BADGE_STYLES: Record<BadgeKey, string> = {
    approved: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
    pending: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
    denied: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
    expiring: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100',
};

const BADGE_LABELS: Record<BadgeKey, string> = {
    approved: 'PA Approved',
    pending: 'PA Pending',
    denied: 'PA Denied',
    expiring: 'PA Expiring',
};

export function PriorAuthHeaderBadges({ records }: Props) {
    const active = useMemo(() => {
        const now = Date.now();
        const keys = new Set<BadgeKey>();
        for (const r of records) {
            if (r.status === 'Approved') {
                const end = parseAuthDate(r.authEndDate);
                const days = daysUntilEnd(r.authEndDate, now);
                if (end && end.getTime() <= now) continue;
                if (days !== null && days < 3) keys.add('expiring');
                else keys.add('approved');
            } else if (r.status === 'Denied') {
                keys.add('denied');
            } else if (
                r.status === 'Pending' ||
                r.status === 'Submitted' ||
                r.status === 'Peer-to-Peer Requested' ||
                r.status === 'Not Started'
            ) {
                keys.add('pending');
            } else if (r.status === 'Expired') {
                keys.add('expiring');
            }
        }
        return keys;
    }, [records]);

    if (active.size === 0) {
        return (
            <p className="text-sm text-gray-500 dark:text-gray-400">No prior authorization status badges for this encounter.</p>
        );
    }

    const order: BadgeKey[] = ['approved', 'pending', 'denied', 'expiring'];

    return (
        <div className="flex flex-wrap gap-2">
            {order
                .filter((k) => active.has(k))
                .map((k) => (
                    <span
                        key={k}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_STYLES[k]}`}
                    >
                        {k === 'approved' && <span className="mr-1" aria-hidden>🔵</span>}
                        {k === 'pending' && <span className="mr-1" aria-hidden>🟡</span>}
                        {k === 'denied' && <span className="mr-1" aria-hidden>🔴</span>}
                        {k === 'expiring' && <span className="mr-1" aria-hidden>⚠️</span>}
                        {BADGE_LABELS[k]}
                    </span>
                ))}
        </div>
    );
}
