import { Link } from 'react-router-dom';
import type { PriorAuthExpiringItem } from '../types/priorAuth.types';
import { facesheetPriorAuthPath } from '../services/priorAuth.service';

type Props = {
    items: PriorAuthExpiringItem[];
    patientNameById?: Record<string, string>;
};

export function PriorAuthExpiringAlerts({ items, patientNameById }: Props) {
    if (items.length === 0) return null;

    return (
        <div className="rounded-lg border border-orange-200/90 bg-orange-50/90 px-3 py-2.5 dark:border-orange-900/40 dark:bg-orange-950/25">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-950 dark:text-orange-100">
                Prior authorizations expiring within 3 days
            </p>
            <ul className="mt-2 space-y-1.5">
                {items.map((item) => {
                    const label = patientNameById?.[item.patientId] ?? item.patientLabel;
                    const tone =
                        item.daysRemaining < 1
                            ? 'text-red-800 dark:text-red-200'
                            : 'text-orange-900 dark:text-orange-200';
                    return (
                        <li key={item.authId} className={`text-xs font-medium ${tone}`}>
                            <Link
                                to={facesheetPriorAuthPath(item.patientId)}
                                className="underline-offset-2 hover:underline"
                            >
                                {label}
                            </Link>
                            {' — '}
                            {item.serviceType} · {item.payerName} · ends{' '}
                            {new Date(item.authEndDate).toLocaleDateString()} ({item.daysRemaining}d)
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
