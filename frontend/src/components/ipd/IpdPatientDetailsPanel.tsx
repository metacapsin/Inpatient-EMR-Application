import React, { memo } from 'react';
import { format } from 'date-fns';
import { ClipboardList, MapPin, MousePointerClick, Stethoscope, UserRound } from 'lucide-react';
import type { IpdBedRow } from '../../types/ipdDashboard';
import {
    ipdModuleCardClass,
    ipdModuleHeaderClass,
    ipdModuleTitleClass,
} from '../../styles/ipdDashboardClasses';
import { cn } from '@/lib/utils';

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

function statusTone(status: string): string {
    const s = status.toLowerCase();
    if (s === 'occupied') return 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-200';
    if (s === 'available') return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/35 dark:text-emerald-300';
    return 'bg-emr-hover text-emr-text border-emr-border dark:bg-white/5 dark:text-gray-300';
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="rounded-lg border border-emr-border/70 bg-[#faf9f7]/80 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-emr-muted dark:text-gray-500">{label}</dt>
            <dd
                className={cn(
                    'mt-0.5 text-[13px] font-semibold text-emr-text dark:text-gray-100',
                    mono && 'font-mono text-xs tabular-nums',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

function IpdPatientDetailsPanelInner({ row, transferBusy, onTransferClick, onStartDischargeClick }: Props) {
    const isOccupied = row?.status.toLowerCase() === 'occupied' && Boolean(row?.patientName);
    const canAct = isOccupied && row?.encounterId;
    const busy = transferBusy;

    return (
        <div className={cn(ipdModuleCardClass, 'h-full')}>
            <div className={ipdModuleHeaderClass}>
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-200">
                        <ClipboardList className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                    </span>
                    <h2 className={ipdModuleTitleClass}>Patient Details</h2>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-3.5">
                {!row ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-3 py-6 text-center">
                        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-emr-border bg-emr-hover/50 text-emr-muted dark:border-white/15 dark:bg-white/[0.03] dark:text-gray-500">
                            <MousePointerClick className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                        </span>
                        <p className="text-sm font-bold text-emr-text dark:text-gray-200">Select a bed</p>
                        <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-emr-muted dark:text-gray-500">
                            Choose a row on the bed board to review assignment, attending physician, and ADT actions.
                        </p>
                        <ul className="mt-4 space-y-1.5 text-left text-[11px] text-emr-muted dark:text-gray-500">
                            <li className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                                Location &amp; status
                            </li>
                            <li className="flex items-center gap-2">
                                <Stethoscope className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                                Care team
                            </li>
                            <li className="flex items-center gap-2">
                                <UserRound className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                                Transfer &amp; discharge
                            </li>
                        </ul>
                    </div>
                ) : (
                    <>
                        <div className="shrink-0 space-y-2.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emr-muted dark:text-gray-500">
                                        Patient
                                    </p>
                                    <p className="mt-0.5 truncate text-base font-bold text-emr-text dark:text-white">
                                        {row.patientName || '—'}
                                    </p>
                                </div>
                                <span
                                    className={cn(
                                        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                        statusTone(row.status),
                                    )}
                                >
                                    {row.status}
                                </span>
                            </div>
                            <div className="rounded-lg border border-emr-border/80 bg-gradient-to-br from-[#faf9f7] to-white px-2.5 py-2 dark:border-white/10 dark:from-[#1c1916] dark:to-[#161412]">
                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emr-muted dark:text-gray-500">
                                    Location
                                </p>
                                <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-emr-text dark:text-gray-200">
                                    {row.ward} · {row.room} · {row.bed}
                                </p>
                            </div>
                        </div>

                        <dl className="mt-3 grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
                            <DetailField label="Admit Date" value={formatAdmitDate(row.admitDate)} />
                            <DetailField label="Doctor" value={row.doctor || '—'} />
                        </dl>

                        <div className="mt-auto shrink-0 space-y-2 border-t border-emr-border/80 pt-3 dark:border-white/10">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emr-muted dark:text-gray-500">
                                ADT Actions
                            </p>
                            <button
                                type="button"
                                disabled={!canAct || busy}
                                onClick={onTransferClick}
                                className="btn btn-outline-primary w-full justify-center py-2 text-sm font-semibold transition-all hover:shadow-sm disabled:opacity-50"
                            >
                                {busy ? 'Working…' : 'Transfer Patient'}
                            </button>
                            <button
                                type="button"
                                disabled={!canAct || busy}
                                onClick={onStartDischargeClick}
                                className="btn btn-primary w-full justify-center py-2 text-sm font-semibold shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                            >
                                Start discharge
                            </button>
                            {isOccupied && !row.encounterId ? (
                                <p className="text-xs text-warning">Encounter ID missing — actions unavailable</p>
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export const IpdPatientDetailsPanel = memo(IpdPatientDetailsPanelInner);
