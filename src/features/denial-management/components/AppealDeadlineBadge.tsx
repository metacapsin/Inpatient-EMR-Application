import { appealDeadlineTone, daysUntil } from '../utils/appealDeadline';

type Props = {
    appealDeadline: string;
};

export function AppealDeadlineBadge({ appealDeadline }: Props) {
    const tone = appealDeadlineTone(appealDeadline);
    const days = daysUntil(appealDeadline);
    const dateLabel = appealDeadline || '—';

    if (tone === 'none') {
        return <span className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{dateLabel}</span>;
    }

    const badgeClass =
        tone === 'red'
            ? 'bg-red-100 text-red-900 border-red-200 dark:bg-red-900/40 dark:text-red-100 dark:border-red-800'
            : 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800';

    const label =
        days !== null && days < 0
            ? 'Past due'
            : days !== null && days < 3
              ? `< 3 days`
              : `< 7 days`;

    return (
        <span className="inline-flex flex-col gap-0.5">
            <span className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{dateLabel}</span>
            <span
                className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
            >
                {label}
            </span>
        </span>
    );
}
