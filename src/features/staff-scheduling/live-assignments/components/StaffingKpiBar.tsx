import type { StaffingKpiSnapshot } from '../../../../types/staffing.types';

interface StaffingKpiBarProps {
    kpis: StaffingKpiSnapshot;
    loading?: boolean;
}

const KPI_ITEMS: { key: keyof StaffingKpiSnapshot; label: string }[] = [
    { key: 'totalPatients', label: 'Total patients' },
    { key: 'totalNurses', label: 'Total nurses' },
    { key: 'averageRatio', label: 'Avg ratio' },
    { key: 'overtimeStaffCount', label: 'Overtime staff' },
    { key: 'unfilledBeds', label: 'Unfilled beds' },
];

export function StaffingKpiBar({ kpis, loading }: StaffingKpiBarProps) {
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {KPI_ITEMS.map(({ key, label }) => {
                const value = kpis[key];
                const display = key === 'averageRatio' ? `1:${value}` : value;
                const warn = key === 'overtimeStaffCount' && value > 0;
                const danger = key === 'unfilledBeds' && value > 0;

                return (
                    <div
                        key={key}
                        className="rounded-xl border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]"
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {label}
                        </p>
                        {loading ? (
                            <div className="mt-1 h-7 w-12 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                        ) : (
                            <p
                                className={`mt-0.5 text-xl font-bold tabular-nums tracking-tight ${
                                    danger
                                        ? 'text-red-700 dark:text-red-300'
                                        : warn
                                          ? 'text-amber-800 dark:text-amber-200'
                                          : 'text-gray-900 dark:text-white'
                                }`}
                            >
                                {display}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
