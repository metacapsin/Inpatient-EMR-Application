import type { PriorAuthDashboardSummary as Summary } from '../types/priorAuth.types';

type Props = {
    summary: Summary;
};

const ITEMS: { key: keyof Summary; label: string }[] = [
    { key: 'notStarted', label: 'Not Started' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'denied', label: 'Denied' },
    { key: 'peerToPeerRequested', label: 'Peer-to-Peer' },
    { key: 'expired', label: 'Expired' },
];

export function PriorAuthDashboardSummary({ summary }: Props) {
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {ITEMS.map(({ key, label }) => (
                <div
                    key={key}
                    className="rounded-lg border border-emr-border/90 bg-white px-3 py-2 text-center shadow-sm dark:border-white/10 dark:bg-[#161412]/80"
                >
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{summary[key]}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {label}
                    </p>
                </div>
            ))}
        </div>
    );
}
