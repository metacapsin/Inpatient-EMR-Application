import { memo } from 'react';
import type { HAIUnitSummary } from '../../types/haiEvent';

type Props = {
    summary: HAIUnitSummary;
    loading?: boolean;
};

const KPI_CONFIG: { key: keyof Pick<
    HAIUnitSummary,
    'totalActiveInfections' | 'isolationPatients' | 'resolvedCases' | 'highSeverityCases'
>; title: string; accent: string }[] = [
    {
        key: 'totalActiveInfections',
        title: 'Total Active Infections',
        accent: 'text-red-600 dark:text-red-400',
    },
    {
        key: 'isolationPatients',
        title: 'Isolation Patients',
        accent: 'text-amber-600 dark:text-amber-400',
    },
    {
        key: 'resolvedCases',
        title: 'Resolved Cases',
        accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
        key: 'highSeverityCases',
        title: 'High Severity Cases',
        accent: 'text-violet-600 dark:text-violet-400',
    },
];

function InfectionQualityKpiRowInner({ summary, loading }: Props) {
    return (
        <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-3 sm:gap-4 shrink-0">
            {KPI_CONFIG.map(({ key, title, accent }) => (
                <div
                    key={key}
                    className="panel rounded-xl border border-white-light dark:border-dark shadow-sm p-4 flex flex-col justify-center min-h-[4.5rem]"
                >
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-tight mb-1">
                        {title}
                    </p>
                    {loading ? (
                        <div className="h-8 w-16 rounded-md bg-gray-100 dark:bg-dark animate-pulse" />
                    ) : (
                        <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${accent}`}>
                            {summary[key].toLocaleString()}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

export const InfectionQualityKpiRow = memo(InfectionQualityKpiRowInner);
