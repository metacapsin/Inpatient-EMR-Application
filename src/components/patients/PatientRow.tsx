import { Eye, CalendarPlus, UserPlus, ArrowRightLeft, DoorOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
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

function statusPillClass(label: string): string {
    const n = label.trim().toLowerCase();
    if (n === 'active' || n === 'true' || n === '1') {
        return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30';
    }
    if (n === 'inactive' || n === 'false' || n === '0') {
        return 'bg-gray-100 text-gray-700 ring-1 ring-gray-500/15 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-500/25';
    }
    return 'bg-gray-50 text-gray-700 ring-1 ring-gray-500/10 dark:bg-gray-800/60 dark:text-gray-300';
}

function PatientStatusCell({ label }: { label: string }) {
    if (!label || label === '—') {
        return <span className="text-sm text-gray-400">—</span>;
    }
    return (
        <span
            className={`inline-flex max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusPillClass(label)}`}
            title={label}
        >
            {label}
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
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-gray-500 transition-colors hover:border-gray-200 hover:bg-gray-100 hover:text-primary disabled:pointer-events-none disabled:opacity-40 dark:hover:border-white/10 dark:hover:bg-white/10';

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
                className={`inline-flex max-w-full items-center truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    dischargePending
                        ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/50 dark:text-amber-100'
                        : transferred
                          ? 'bg-sky-100 text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950/45 dark:text-sky-100'
                          : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-100'
                }`}
                title={admittedTitle}
            >
                {dischargePending ? 'Discharge…' : transferred ? 'Transferred' : 'Admitted'}
            </span>
        ) : (
            <span className="inline-flex max-w-full truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300">
                Not admitted
            </span>
        );

    const hideAdmit = serverAdmitted || workspaceAdmitted;

    const actions = onOpenAdt ? (
        <div className="flex flex-wrap gap-1">
            {!hideAdmit ? (
                <button type="button" title="Admit" onClick={open('admit')} className={btnClass}>
                    <UserPlus className="h-3.5 w-3.5" aria-hidden />
                </button>
            ) : null}
            <button
                type="button"
                title="Transfer"
                disabled={!encounterReady || dischargePending}
                onClick={open('transfer')}
                className={btnClass} 
            >
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
                type="button"
                title={
                    !bedReadyForDischarge && encounterReady && !dischargePending
                        ? 'No bed linked to this encounter — refresh the chart'
                        : dischargePending
                          ? 'Continue discharge readiness'
                          : 'Start discharge'
                }
                disabled={!encounterReady || (!bedReadyForDischarge && !dischargePending)}
                onClick={startDischarge}
                className={btnClass}
            >
                <DoorOpen className="h-3.5 w-3.5" aria-hidden />
            </button>
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
        <tr className="transition-colors hover:bg-gray-50/40">
            <td className="max-w-0 px-2 py-2 align-middle">
                <div className="flex min-w-0 items-center gap-2">
                    {patient.profilePicture ? (
                        <img
                            src={patient.profilePicture}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-gray-200"
                        />
                    ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[10px] font-bold text-primary ring-1 ring-primary/20">
                            {initials(patient.name)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{patient.name}</p>
                        {/* <p className="truncate text-[11px] text-gray-500">{patient.email || '—'}</p> */}
                    </div>
                </div>
            </td>
            <td className="max-w-0 px-2 py-2 text-xs text-gray-700">
                <div className="min-w-0">
                    <span className="block truncate tabular-nums" title={patient.dob}>
                        {patient.dob}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500 tabular-nums dark:text-gray-400" title={formatAgeLabelFromDobRaw(patient.dobRaw)}>
                        {formatAgeLabelFromDobRaw(patient.dobRaw)}
                    </span>
                </div>
            </td>
            <td className="px-2 py-2 text-center text-xs text-gray-700">{patient.gender}</td>
            {/* <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700" title={patient.ward}>
                {patient.ward}
            </td>
            <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700 tabular-nums" title={patient.room}>
                {patient.room}
            </td>
            <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700 tabular-nums" title={patient.bed}>
                {patient.bed}
            </td> */}
            <td className="max-w-0 px-2 py-2 text-xs text-gray-700">
                <PatientStatusCell label={patient.statusLabel} />
            </td>
            <td className="max-w-0 px-2 py-2 align-top">
                <InpatientAdtCell
                    patient={patient}
                    chartId={chartId}
                    serverActivePatientIds={serverActivePatientIds}
                    activeEncounterIdByPatientId={activeEncounterIdByPatientId}
                    onOpenAdt={onOpenAdt}
                />
            </td>
            <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700 tabular-nums" title={patient.phone || undefined}>
                {patient.phone}
            </td>
            <td className="max-w-0 truncate px-2 py-2 text-xs text-gray-700 tabular-nums" title={patient.createdDate || undefined}>
                {patient.createdDate}
            </td>
            <td className="whitespace-nowrap px-1 py-2">
                {/* <div className="flex items-center justify-end gap-0.5">
                    <button
                        type="button"
                        title="Book appointment"
                        onClick={handleBookAppointment}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                        <CalendarPlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        title="View"
                        onClick={handleView}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                        <Eye className="h-3.5 w-3.5" />
                    </button>
                </div> */}
                <div className="flex items-center justify-end gap-0.5">
    
  {/* Book Appointment */}
  <div className="relative group">
    <button
      type="button"
      title=""   // title empty so default tooltip off
      onClick={handleBookAppointment}
      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
    >
      <CalendarPlus className="h-3.5 w-3.5" />
    </button>

    {/* Custom Tooltip */}
    <span className="absolute -top-8 left-1/2 -translate-x-1/2 
                     hidden group-hover:block 
                     bg-black text-white text-xs rounded px-2 py-1 
                     whitespace-nowrap z-50">
      Book appointment
    </span>
  </div>

  {/* View Button */}
  <div className="relative group">
    <button
      type="button"
      title=""
      onClick={handleView}
      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
    >
      <Eye className="h-3.5 w-3.5" />
    </button>

    <span className="absolute -top-8 left-1/2 -translate-x-1/2 
                     hidden group-hover:block 
                     bg-black text-white text-xs rounded px-2 py-1 
                     whitespace-nowrap z-50">
      View
    </span>
  </div>

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
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
                {patient.profilePicture ? (
                    <img
                        src={patient.profilePicture}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-gray-200"
                    />
                ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
                        {initials(patient.name)}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{patient.name}</p>
                    <p className="text-xs text-gray-500">{patient.email || '—'}</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span className="text-gray-400">DOB</span>
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
                        <span className="text-gray-400">Status</span>
                        <span className="flex justify-end">
                            <PatientStatusCell label={patient.statusLabel} />
                        </span>
                        <span className="text-gray-400">Phone</span>
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
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                title="Book appointment"
                                onClick={handleBookAppointment}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                            >
                                <CalendarPlus className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                title="View"
                                onClick={handleView}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
