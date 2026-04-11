import React, { memo } from 'react';
import type { DischargeReadinessView, ReadinessGate } from '../../../types/dischargeReadiness';

type Props = {
    view: DischargeReadinessView;
};

function statusPill(ok: boolean, label: string) {
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

function GateRow({ g }: { g: ReadinessGate }) {
    const hard = g.severity === 'hard';
    return (
        <li
            className={`flex flex-wrap items-start gap-2 border-b border-gray-100 py-2 text-sm last:border-0 dark:border-gray-700/80 ${
                g.resolved ? 'text-gray-500 dark:text-gray-400' : hard ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
            }`}
        >
            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${g.resolved ? 'bg-emerald-500' : hard ? 'bg-red-500' : 'bg-amber-400'}`} />
            <div className="min-w-0 flex-1">
                <span className="font-medium">{g.message}</span>
                <span className="ml-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {g.ownerRole} · {g.category}
                    {hard ? ' · hard' : ' · soft'}
                </span>
            </div>
        </li>
    );
}

function DischargeReadinessHeaderInner({ view }: Props) {
    const openHard = view.gates.filter((g) => g.severity === 'hard' && !g.resolved);
    const openSoft = view.gates.filter((g) => g.severity === 'soft' && !g.resolved);

    return (
        <div className="rounded-xl border border-white-light bg-white shadow-sm dark:border-dark dark:bg-black">
            <div className="border-b border-white-light px-4 py-3 dark:border-dark">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Discharge &amp; billing readiness</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Clinical and financial tracks are separate; resolve hard blockers before final claim submission.
                </p>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Encounter</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{view.context.patientName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        MRN {view.context.mrn} · {view.context.locationLabel}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Admit {new Date(view.context.admitDate).toLocaleString()} · Attending {view.context.attendingName}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</p>
                    <div className="flex flex-wrap gap-2">
                        {statusPill(view.clinicalReady, 'Clinical discharge')}
                        {statusPill(view.billingReady, 'Bill / claim')}
                    </div>
                    {openHard.length > 0 ? (
                        <p className="text-sm text-red-700 dark:text-red-300">
                            {openHard.length} hard blocker{openHard.length === 1 ? '' : 's'} remaining
                        </p>
                    ) : openSoft.length > 0 ? (
                        <p className="text-sm text-amber-800 dark:text-amber-200">{openSoft.length} soft warning(s)</p>
                    ) : (
                        <p className="text-sm text-emerald-800 dark:text-emerald-200">No open readiness issues</p>
                    )}
                </div>
            </div>
            <div className="border-t border-white-light px-4 py-3 dark:border-dark">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Blockers &amp; checks</p>
                <ul className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50/80 px-3 dark:border-gray-700 dark:bg-gray-900/40">
                    {view.gates.map((g) => (
                        <GateRow key={g.id} g={g} />
                    ))}
                </ul>
            </div>
        </div>
    );
}

export const DischargeReadinessHeader = memo(DischargeReadinessHeaderInner);
