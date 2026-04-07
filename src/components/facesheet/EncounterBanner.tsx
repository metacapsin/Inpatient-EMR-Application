import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Activity, ArrowRightLeft, BedDouble, DoorOpen, Stethoscope, UserPlus } from 'lucide-react';
import type { FacesheetPatient } from '../../services/patient.service';
import { formatLocationLine } from '../../types/patientLocation';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { AdtPatientWorkflowModal } from '../adt/AdtPatientWorkflowModal';

function pickAttendingLabel(raw: Record<string, unknown>): string {
    const keys = [
        'attendingPhysicianName',
        'attendingPhysician',
        'attendingProviderName',
        'primaryCarePhysician',
        'pcpName',
        'doctorName',
        'providerName',
    ] as const;
    for (const k of keys) {
        const v = raw[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '—';
}

interface EncounterBannerProps {
    patient: FacesheetPatient;
    /** e.g. `/app/facesheet/:id` */
    moduleBase: string;
}

type AdtBannerModal =
    | { intent: 'admit' }
    | { intent: 'transfer' }
    | { intent: 'discharge'; dischargeInitialStep: 'initiate' | 'confirm' };

export function EncounterBanner({ patient, moduleBase }: EncounterBannerProps) {
    const [adtModal, setAdtModal] = useState<AdtBannerModal | null>(null);
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patient.id));

    const locationLine = formatLocationLine(patient.location);
    const bedDisplay = locationLine.trim() ? locationLine : 'No bed on file';
    const doctor = pickAttendingLabel(patient.raw);
    const adtHref = `${moduleBase.replace(/\/$/, '')}/adt`;

    const statusLabel = !session
        ? 'No active encounter'
        : session.dischargeInitiated
          ? 'Discharge initiated'
          : 'In progress';

    const statusClass = !session
        ? 'bg-gray-100 text-gray-700 ring-gray-500/15 dark:bg-gray-800 dark:text-gray-300'
        : session.dischargeInitiated
          ? 'bg-amber-100 text-amber-900 ring-amber-500/25 dark:bg-amber-950/50 dark:text-amber-100'
          : 'bg-sky-100 text-sky-900 ring-sky-500/20 dark:bg-sky-950/40 dark:text-sky-100';

    return (
        <>
            <section
                className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-white to-white px-4 py-4 shadow-sm dark:border-primary/25 dark:from-primary/10 dark:via-[#141210] dark:to-[#141210] sm:px-6"
                aria-label="Encounter and placement"
            >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
                        <div className="flex min-w-0 items-start gap-3 rounded-xl bg-white/70 px-3 py-3 dark:bg-white/[0.06] sm:flex-1">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                <BedDouble className="h-5 w-5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                    Current bed
                                </p>
                                <p className="mt-1 text-sm font-semibold leading-snug text-gray-900 dark:text-white">{bedDisplay}</p>
                            </div>
                        </div>
                        <div className="flex min-w-0 items-start gap-3 rounded-xl bg-white/70 px-3 py-3 dark:bg-white/[0.06] sm:flex-1">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                <Activity className="h-5 w-5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                    Encounter status
                                </p>
                                <p className="mt-2">
                                    <span
                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusClass}`}
                                    >
                                        {statusLabel}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="flex min-w-0 items-start gap-3 rounded-xl bg-white/70 px-3 py-3 dark:bg-white/[0.06] sm:flex-1">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                <Stethoscope className="h-5 w-5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                    Doctor
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{doctor}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
                        <button
                            type="button"
                            disabled={!!session}
                            onClick={() => setAdtModal({ intent: 'admit' })}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-45"
                        >
                            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                            Admit
                        </button>
                        <button
                            type="button"
                            disabled={!session || session.dischargeInitiated}
                            onClick={() => setAdtModal({ intent: 'transfer' })}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-45 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />
                            Transfer
                        </button>
                        <button
                            type="button"
                            disabled={!session || session.dischargeInitiated}
                            onClick={() => setAdtModal({ intent: 'discharge', dischargeInitialStep: 'initiate' })}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-45 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                        >
                            <DoorOpen className="h-4 w-4 shrink-0" aria-hidden />
                            Begin discharge
                        </button>
                        <button
                            type="button"
                            disabled={!session?.dischargeInitiated}
                            onClick={() => setAdtModal({ intent: 'discharge', dischargeInitialStep: 'confirm' })}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-45"
                        >
                            Confirm discharge
                        </button>
                        <Link
                            to={adtHref}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/5 px-4 py-2 text-center text-sm font-semibold text-primary transition hover:bg-primary/10"
                        >
                            Full ADT workspace
                        </Link>
                    </div>
                </div>
            </section>

            {adtModal ? (
                <AdtPatientWorkflowModal
                    open
                    patientId={patient.id}
                    patientLabel={patient.fullName}
                    intent={adtModal.intent}
                    dischargeInitialStep={adtModal.intent === 'discharge' ? adtModal.dischargeInitialStep : undefined}
                    onClose={() => setAdtModal(null)}
                    facesheetPatientId={patient.id}
                />
            ) : null}
        </>
    );
}
