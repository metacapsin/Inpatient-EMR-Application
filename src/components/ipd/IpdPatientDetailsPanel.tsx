import React, { memo } from 'react';
import { format } from 'date-fns';
import type { IpdBedRow } from '../../types/ipdDashboard';

type Props = {
    row: IpdBedRow | null;
    transferBusy: boolean;
    onTransferClick: () => void;
    onStartDischargeClick: () => void;
};

function formatAdmitDate(raw: string | null): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return raw;
        return format(d, 'MMM d, yyyy');
    } catch {
        return raw;
    }
}

function IpdPatientDetailsPanelInner({ row, transferBusy, onTransferClick, onStartDischargeClick }: Props) {
    const isOccupied = row?.status.toLowerCase() === 'occupied' && Boolean(row?.patientName);
    const canAct = isOccupied && row?.encounterId;
    const busy = transferBusy;

    return (
        <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm flex flex-col min-h-0 h-full overflow-hidden">
            <div className="shrink-0 px-4 py-3 border-b border-white-light dark:border-dark">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Patient Details</h2>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
                {!row ? (
                    <div className="flex-1 flex items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400 px-2">
                        Select a bed to view patient details
                    </div>
                ) : (
                    <>
                        <dl className="space-y-3 text-sm shrink-0">
                            <div>
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Patient Name</dt>
                                <dd className="mt-0.5 font-semibold text-gray-900 dark:text-white">{row.patientName || '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Admit Date</dt>
                                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{formatAdmitDate(row.admitDate)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ward / Room / Bed</dt>
                                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">
                                    {row.ward} / {row.room} / {row.bed}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Doctor</dt>
                                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{row.doctor}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</dt>
                                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{row.status}</dd>
                            </div>
                        </dl>
                        <div className="mt-6 pt-4 border-t border-white-light dark:border-dark space-y-2 shrink-0">
                            <button
                                type="button"
                                disabled={!canAct || busy}
                                onClick={onTransferClick}
                                className="btn btn-outline-primary w-full justify-center text-sm py-2 disabled:opacity-50"
                            >
                                {busy ? 'Working…' : 'Transfer Patient'}
                            </button>
                            <button
                                type="button"
                                disabled={!canAct || busy}
                                onClick={onStartDischargeClick}
                                className="btn btn-primary w-full justify-center text-sm py-2 disabled:opacity-50"
                            >
                                Start discharge
                            </button>
                            {isOccupied && !row.encounterId ? (
                                <p className="text-xs text-warning mt-1">Encounter ID missing — actions unavailable</p>
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export const IpdPatientDetailsPanel = memo(IpdPatientDetailsPanelInner);
