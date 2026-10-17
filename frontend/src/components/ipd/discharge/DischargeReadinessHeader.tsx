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
            className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold leading-tight ${
                ok
                    ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100'
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
        <div data-encounter-claim-context className="bg-white px-3 py-2 dark:bg-transparent sm:px-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Encounter context
                    </h2>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs leading-snug text-gray-600 dark:text-gray-300">
                        <p className="min-w-0">
                            <span className="font-medium text-gray-800 dark:text-gray-100">Admitted</span>{' '}
                            {new Date(view.context.admitDate).toLocaleString()}
                        </p>
                        <p className="min-w-0">
                            <span className="font-medium text-gray-800 dark:text-gray-100">Attending</span>{' '}
                            {view.context.attendingName}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                    {pill(snapshot.isClinicalReady, 'Clinical discharge')}
                    {pill(snapshot.isBillingReady, 'Bill / claim')}
                </div>
            </div>
        </div>
    );
}

export const DischargeReadinessHeader = memo(DischargeReadinessHeaderInner);
