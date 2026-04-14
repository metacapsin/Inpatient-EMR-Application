import React, { memo, useMemo } from 'react';
import type { DischargeReadinessView } from '../../../types/dischargeReadiness';
import { useDischargeReadinessOptional } from '../../../contexts/DischargeReadinessContext';
import { computeReadinessSnapshot } from '../../../utils/dischargeReadinessValidation';

type Props = {
    view: DischargeReadinessView;
};

function pill(ok: boolean, label: string) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                ok
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                    : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
            }`}
        >
            {label}: {ok ? 'Ready' : 'Not ready'}
        </span>
    );
}

function DischargeReadinessHeaderInner({ view }: Props) {
    const ctx = useDischargeReadinessOptional();
    const snapshot = useMemo(() => ctx?.snapshot ?? computeReadinessSnapshot(view), [ctx?.snapshot, view]);

    return (
        <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Encounter context</h2>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1 text-sm">
                    <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">Admitted</span>{' '}
                        {new Date(view.context.admitDate).toLocaleString()}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">Attending</span>{' '}
                        {view.context.attendingName}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {pill(snapshot.isClinicalReady, 'Clinical discharge')}
                    {pill(snapshot.isBillingReady, 'Bill / claim')}
                </div>
            </div>
        </div>
    );
}

export const DischargeReadinessHeader = memo(DischargeReadinessHeaderInner);
