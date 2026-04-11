import React, { memo } from 'react';
import type { IpdKpis } from '../../types/ipdDashboard';

type Props = {
    kpis: IpdKpis;
    loading?: boolean;
};

const labels: { key: keyof IpdKpis; title: string }[] = [
    { key: 'totalAdmittedPatients', title: 'Total Admitted Patients' },
    { key: 'occupiedBeds', title: 'Occupied Beds' },
    { key: 'availableBeds', title: 'Available Beds' },
    { key: 'dischargedToday', title: 'Discharged Today' },
];

function IpdKpiRowInner({ kpis, loading }: Props) {
    return (
        <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-3 sm:gap-4 shrink-0">
            {labels.map(({ key, title }) => (
                <div
                    key={key}
                    className="panel rounded-xl border border-white-light dark:border-dark shadow-sm p-4 flex flex-col justify-center min-h-[4.5rem]"
                >
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-tight mb-1">{title}</p>
                    {loading ? (
                        <div className="h-8 w-16 rounded-md bg-gray-100 dark:bg-dark animate-pulse" />
                    ) : (
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                            {kpis[key].toLocaleString()}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

export const IpdKpiRow = memo(IpdKpiRowInner);
