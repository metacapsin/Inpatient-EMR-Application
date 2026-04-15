import { Eye, CalendarPlus, UserPlus, ArrowRightLeft, DoorOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ActionIconTooltip } from '@/components/ui/ActionIconTooltip';
import { formatAgeLabelFromDobRaw, getPatientListRowId, type PatientListItem } from '../../services/patient.service';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import type { AdtWorkflowIntent } from '../adt/AdtPatientWorkflowModal';
import { hasValidAdtBedForDischarge } from '../../services/adt.service';

interface PatientRowProps {
    patient: PatientListItem;
    serverActivePatientIds?: ReadonlySet<string>;
    activeEncounterIdByPatientId?: ReadonlyMap<string, string>;
    onOpenAdt?: (patient: PatientListItem, intent: AdtWorkflowIntent) => void;
}

function initials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function patientStatusPillClass(label: string): string {
    const n = label.trim().toLowerCase();
    if (!n || n === '—') {
        return 'border border-gray-200/80 bg-gray-50/90 text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400';
    }
    if (n === 'active' || n === 'true' || n === '1') {
        return 'border border-emerald-100/90 bg-emerald-50/90 text-emerald-900/80 dark:border-emerald-900/35 dark:bg-emerald-950/30 dark:text-emerald-100/90';
    }
    if (n === 'inactive' || n === 'false' || n === '0') {
        return 'border border-stone-200/90 bg-stone-100/90 text-stone-700 dark:border-white/[0.08] dark:bg-stone-900/40 dark:text-stone-200';
    }
    return 'border border-gray-200/80 bg-gray-50/90 text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300';
}

function PatientStatusCell({ label }: { label: string }) {
    if (!label || label === '—') {
        return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
    }
    return (
        <span
            className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize leading-tight ${patientStatusPillClass(label)}`}
            title={label}
        >
            <span className="truncate">{label}</span>
        </span>
    );
}

function InpatientAdtCell({
    patient,
    chartId,
    serverActivePatientIds,
    activeEncounterIdByPatientId,
    onOpenAdt,
    layout = 'stacked',
}: {
    patient: PatientListItem;
    chartId: string;
    serverActivePatientIds?: ReadonlySet<string>;
    activeEncounterIdByPatientId?: ReadonlyMap<string, string>;
    onOpenAdt?: (patient: PatientListItem, intent: AdtWorkflowIntent) => void;
    layout?: 'stacked' | 'inline';
}) {
    const navigate = useNavigate();
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, chartId));
    const pid = chartId.trim();
    const serverAdmitted = Boolean(pid && serverActivePatientIds?.has(pid));
    const encounterReady = Boolean(session?.encounterId?.trim());
    const workspaceAdmitted = encounterReady;
    const showAdmittedBadge = serverAdmitted || workspaceAdmitted;
    const dischargePending = !!session?.dischargeInitiated;
    const bedReadyForDischarge = hasValidAdtBedForDischarge(session);
    const transferred =
        workspaceAdmitted && !dischargePending && session?.lastPlacementAction === 'transfer';

    const open = (intent: AdtWorkflowIntent) => (e: React.MouseEvent) => {
        e.stopPropagation();
        onOpenAdt?.(patient, intent);
    };

    const startDischarge = (e: React.MouseEvent) => {
        e.stopPropagation();
        const pid = chartId.trim();
        const encFromServer = activeEncounterIdByPatientId?.get(pid)?.trim();
        const encFromSession = session?.encounterId?.trim();
        const encounterId = encFromServer || encFromSession || '';
        const qs = new URLSearchParams();
        qs.set('patientId', pid);
        if (encounterId) qs.set('encounterId', encounterId);
        navigate(`/app/inpatient/discharge-readiness?${qs.toString()}`);
    };

    const btnClass =
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]';

    const admittedTitle =
        dischargePending
            ? 'Discharge initiated — confirm in chart or here'
            : transferred
              ? 'Patient moved to another bed in this session'
              : serverAdmitted && !workspaceAdmitted
                ? 'Active inpatient encounter (synced from server / bed board)'
                : 'Active inpatient encounter in workspace';

    const badge =
        showAdmittedBadge ? (
            <span
                className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize leading-tight ${
                    dischargePending
                        ? 'border border-amber-200/90 bg-amber-50/90 text-amber-900/85 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100/90'
                        : transferred
                          ? 'border border-sky-200/90 bg-sky-50/90 text-sky-900/80 dark:border-sky-900/35 dark:bg-sky-950/30 dark:text-sky-100/90'
                          : 'border border-emerald-100/90 bg-emerald-50/90 text-emerald-900/80 dark:border-emerald-900/35 dark:bg-emerald-950/30 dark:text-emerald-100/90'
                }`}
                title={admittedTitle}
            >
                <span className="truncate">{dischargePending ? 'Discharge…' : transferred ? 'Transferred' : 'Admitted'}</span>
            </span>
        ) : (
            <span className="inline-flex max-w-full items-center rounded-full border border-gray-200/80 bg-gray-50/90 px-2 py-0.5 text-[11px] font-medium capitalize leading-tight text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400">
                <span className="truncate">Not admitted</span>
            </span>
        );

    const hideAdmit = serverAdmitted || workspaceAdmitted;

    const dischargeTip =
        !bedReadyForDischarge && encounterReady && !dischargePending
            ? 'No bed linked to this encounter — refresh the chart'
            : dischargePending
              ? 'Continue discharge readiness'
              : 'Start discharge';

    const dischargeAria =
        !bedReadyForDischarge && encounterReady && !dischargePending
            ? 'Discharge unavailable: no bed linked'
            : dischargePending
              ? 'Continue discharge readiness'
              : 'Start discharge';

    const actions = onOpenAdt ? (
        <div className="flex flex-wrap gap-1">
            {!hideAdmit ? (
                <ActionIconTooltip label="Admit">
                    <button type="button" aria-label="Admit" onClick={open('admit')} className={btnClass}>
                        <UserPlus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                </ActionIconTooltip>
            ) : null}
            <ActionIconTooltip label="Transfer">
                <button
                    type="button"
                    aria-label="Transfer"
                    disabled={!encounterReady || dischargePending}
                    onClick={open('transfer')}
                    className={btnClass}
                >
                    <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
                </button>
            </ActionIconTooltip>
            <ActionIconTooltip label={dischargeTip}>
                <button
                    type="button"
                    aria-label={dischargeAria}
                    disabled={!encounterReady || (!bedReadyForDischarge && !dischargePending)}
                    onClick={startDischarge}
                    className={btnClass}
                >
                    <DoorOpen className="h-3.5 w-3.5" aria-hidden />
                </button>
            </ActionIconTooltip>
        </div>
    ) : null;

    if (layout === 'inline') {
        return (
            <div className="flex flex-wrap items-center justify-between gap-2 py-0.5">
                {badge}
                {actions}
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1 py-0.5">
            <div className="min-w-0">{badge}</div>
            {actions}
        </div>
    );
}

export function PatientTableRow({
    patient,
    serverActivePatientIds,
    activeEncounterIdByPatientId,
    onOpenAdt,
}: PatientRowProps) {
    const navigate = useNavigate();
    const chartId = getPatientListRowId(patient);

    const goToFacesheet = () => {
        navigate(`/app/facesheet/${encodeURIComponent(chartId)}`);
    };

    const handleView = (e: React.MouseEvent) => {
        e.stopPropagation();
        goToFacesheet();
    };

    const handleBookAppointment = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/app/appointments/add?patientId=${encodeURIComponent(chartId)}`);
    };

    return (
        <tr className="transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.04]">
            <td className="max-w-0 px-2.5 py-1.5 align-middle">
                <div className="flex min-w-0 items-center gap-2">
                    {patient.profilePicture ? (
                        <img
                            src={patient.profilePicture}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-gray-200 dark:ring-white/[0.08]"
                        />
                    ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[10px] font-bold text-primary ring-1 ring-primary/20">
                            {initials(patient.name)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{patient.name}</p>
                        {/* <p className="truncate text-[11px] text-gray-500">{patient.email || '—'}</p> */}
                    </div>
                </div>
            </td>
            <td className="max-w-0 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300">
                <div className="min-w-0">
                    <span className="block truncate tabular-nums" title={patient.dob}>
                        {patient.dob}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500 tabular-nums dark:text-gray-400" title={formatAgeLabelFromDobRaw(patient.dobRaw)}>
                        {formatAgeLabelFromDobRaw(patient.dobRaw)}
                    </span>
                </div>
            </td>
            <td className="px-2.5 py-1.5 text-center text-xs text-gray-800 dark:text-gray-200">{patient.gender}</td>
            {/* <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700" title={patient.ward}>
                {patient.ward}
            </td>
            <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700 tabular-nums" title={patient.room}>
                {patient.room}
            </td>
            <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700 tabular-nums" title={patient.bed}>
                {patient.bed}
            </td> */}
            <td className="max-w-0 px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200">
                <PatientStatusCell label={patient.statusLabel} />
            </td>
            <td className="max-w-0 px-2.5 py-1.5 align-top">
                <InpatientAdtCell
                    patient={patient}
                    chartId={chartId}
                    serverActivePatientIds={serverActivePatientIds}
                    activeEncounterIdByPatientId={activeEncounterIdByPatientId}
                    onOpenAdt={onOpenAdt}
                />
            </td>
            <td className="max-w-0 truncate px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 tabular-nums" title={patient.phone || undefined}>
                {patient.phone}
            </td>
            <td className="max-w-0 truncate px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 tabular-nums" title={patient.createdDate || undefined}>
                {patient.createdDate}
            </td>
            <td className="whitespace-nowrap px-2.5 py-1.5 text-right">
                <div className="flex items-center justify-end gap-0.5">
                    <ActionIconTooltip label="Book appointment">
                        <button
                            type="button"
                            aria-label="Book appointment"
                            onClick={handleBookAppointment}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]"
                        >
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                    </ActionIconTooltip>
                    <ActionIconTooltip label="View">
                        <button
                            type="button"
                            aria-label="View chart"
                            onClick={handleView}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]"
                        >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                        </button>
                    </ActionIconTooltip>
                </div>
            </td>
        </tr>
    );
}

export function PatientMobileCard({
    patient,
    serverActivePatientIds,
    activeEncounterIdByPatientId,
    onOpenAdt,
}: PatientRowProps) {
    const navigate = useNavigate();
    const chartId = getPatientListRowId(patient);

    const goToFacesheet = () => {
        navigate(`/app/facesheet/${encodeURIComponent(chartId)}`);
    };

    const handleView = (e: React.MouseEvent) => {
        e.stopPropagation();
        goToFacesheet();
    };

    const handleBookAppointment = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/app/appointments/add?patientId=${encodeURIComponent(chartId)}`);
    };

    return (
        <article className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1a1a1a]">
            <div className="flex items-start gap-3">
                {patient.profilePicture ? (
                    <img
                        src={patient.profilePicture}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-white/[0.08]"
                    />
                ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
                        {initials(patient.name)}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{patient.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{patient.email || '—'}</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                        <span className="font-bold text-dark dark:text-gray-200">DOB</span>
                        <span className="text-right">
                            <span className="block tabular-nums">{patient.dob}</span>
                            <span className="block text-gray-500 tabular-nums dark:text-gray-400">
                                {formatAgeLabelFromDobRaw(patient.dobRaw)}
                            </span>
                        </span>
                        {/* <span className="text-gray-400">Ward</span>
                        <span className="truncate text-right">{patient.ward}</span>
                        <span className="text-gray-400">Room</span>
                        <span className="text-right tabular-nums">{patient.room}</span>
                        <span className="text-gray-400">Bed</span>
                        <span className="text-right tabular-nums">{patient.bed}</span> */}
                        <span className="font-bold text-dark dark:text-gray-200">Status</span>
                        <span className="flex justify-end">
                            <PatientStatusCell label={patient.statusLabel} />
                        </span>
                        <span className="font-bold text-dark dark:text-gray-200">Phone</span>
                        <span>{patient.phone}</span>
                    </div>
                    {onOpenAdt ? (
                        <div className="mt-3 rounded-lg bg-gray-50/80 px-2 py-2 dark:bg-white/[0.04]">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Inpatient (ADT)
                            </p>
                            <InpatientAdtCell
                                patient={patient}
                                chartId={chartId}
                                serverActivePatientIds={serverActivePatientIds}
                                activeEncounterIdByPatientId={activeEncounterIdByPatientId}
                                onOpenAdt={onOpenAdt}
                                layout="inline"
                            />
                        </div>
                    ) : null}
                    <div className="mt-3 flex justify-end">
                        <div className="flex items-center gap-0.5">
                            <ActionIconTooltip label="Book appointment">
                                <button
                                    type="button"
                                    aria-label="Book appointment"
                                    onClick={handleBookAppointment}
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]"
                                >
                                    <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                                </button>
                            </ActionIconTooltip>
                            <ActionIconTooltip label="View">
                                <button
                                    type="button"
                                    aria-label="View chart"
                                    onClick={handleView}
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]"
                                >
                                    <Eye className="h-3.5 w-3.5" aria-hidden />
                                </button>
                            </ActionIconTooltip>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
