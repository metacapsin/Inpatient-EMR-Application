import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { ChevronRight } from 'lucide-react';
import type { FacesheetPatient } from '../../services/patient.service';
import { formatPatientHeaderBedLine } from '../../types/patientLocation';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { fetchEmrBedList, filterAvailableBeds, formatBedHeaderLine } from '../../services/emrBeds.service';
import { hasValidAdtBedForDischarge } from '../../services/adt.service';
import { AdtPatientWorkflowModal } from '../adt/AdtPatientWorkflowModal';
import { EncounterStatusBadge } from './EncounterStatusBadge';
import { EncounterActionButtons } from './EncounterActionButtons';
import { IoHeaderBadge } from './IoHeaderBadge';
import type { EncounterHeaderAdtModalState, EncounterStatusVariant } from './encounterHeaderTypes';

const HEADER_VALUE_BADGE_CLASS =
    'inline-flex max-w-full shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal ring-1 bg-gray-100 text-gray-800 ring-gray-400/20 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-500/25';

/** Strip leading "Bed " when formatters already include it; header shows "Bed" as its own label. */
function headerBedBadgeValue(raw: string): string {
    const t = raw.trim();
    if (t === '—') return t;
    if (/^Bed\s+/i.test(t)) {
        const rest = t.replace(/^Bed\s+/i, '').trim();
        return rest || '—';
    }
    return t;
}

export interface EncounterHeaderProps {
    patient: FacesheetPatient;
    patientListHref?: string;
}

function resolveStatus(session: ReturnType<typeof selectAdtEncounter>): {
    variant: EncounterStatusVariant;
    label: string;
} {
    if (!session?.encounterId?.trim()) {
        return { variant: 'not_admitted', label: 'Not admitted' };
    }
    if (session.dischargeInitiated) {
        return { variant: 'discharge_initiated', label: 'Discharge initiated' };
    }
    if (session.lastPlacementAction === 'transfer') {
        return { variant: 'transferred', label: 'Transferred' };
    }
    return { variant: 'active', label: 'Active' };
}

export function EncounterHeader({ patient, patientListHref = '/app/patients/list' }: EncounterHeaderProps) {
    const navigate = useNavigate();
    const [adtModal, setAdtModal] = useState<EncounterHeaderAdtModalState | null>(null);
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patient.id));

    const bedsQuery = useQuery({
        queryKey: ['beds', 'emr-list'],
        queryFn: fetchEmrBedList,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });

    const availableBeds = useMemo(
        () => filterAvailableBeds(bedsQuery.data ?? []),
        [bedsQuery.data]
    );

    const encounterBedLabel = useMemo(() => {
        const bid = session?.currentBedMongoId?.trim();
        if (!bid || !session?.encounterId?.trim()) return '';
        const item = (bedsQuery.data ?? []).find((b) => b.id === bid);
        return item ? formatBedHeaderLine(item) : '';
    }, [session?.currentBedMongoId, session?.encounterId, bedsQuery.data]);

    const patientLocBedLine = formatPatientHeaderBedLine(patient.location);
    const bedDisplay = headerBedBadgeValue(
        encounterBedLabel.trim() || patientLocBedLine.trim() || '—'
    );

    const status = resolveStatus(session);
    const admitted = Boolean(session?.encounterId?.trim());
    const bedReadyForDischarge = hasValidAdtBedForDischarge(session);

    const transferBlockedNoBeds = admitted && bedsQuery.isSuccess && availableBeds.length === 0;

    const goDischargeReadiness = useCallback(() => {
        const qs = new URLSearchParams();
        qs.set('patientId', patient.id);
        const eid = session?.encounterId?.trim();
        if (eid) qs.set('encounterId', eid);
        navigate(`/app/inpatient/discharge-readiness?${qs.toString()}`);
    }, [navigate, patient.id, session?.encounterId]);

    return (
        <>
            <header
                className="sticky top-0 z-30 border-b border-gray-200/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-white/10 dark:bg-[#141210] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)] dark:backdrop-blur-none"
                aria-label="Patient and encounter"
            >
                <nav
                    className="flex items-center gap-1 border-b border-gray-100/80 px-3 py-1 text-[10px] font-medium text-gray-500 dark:border-white/5 dark:text-gray-400"
                    aria-label="Breadcrumb"
                >
                    <Link
                        to={patientListHref}
                        className="text-gray-600 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary-200"
                    >
                        Patients
                    </Link>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                    <span className="truncate text-gray-600 dark:text-gray-300">Chart</span>
                </nav>

                <div className="flex min-h-[52px] flex-col justify-center gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex min-w-0 items-baseline gap-2">
                            <h1 className="truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white sm:text-base">
                                {patient.fullName}
                            </h1>
                            <EncounterStatusBadge variant={status.variant} label={status.label} />
                            {admitted ? <IoHeaderBadge /> : null}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                            <span className="flex shrink-0 items-center gap-1.5">
                                <span className="font-medium text-gray-400 dark:text-gray-500">MRN</span>
                                <span className={`${HEADER_VALUE_BADGE_CLASS} font-mono tabular-nums`}>
                                    {patient.mrn}
                                </span>
                            </span>
                            <span className="hidden h-3 w-px bg-gray-200 dark:bg-white/10 sm:inline" aria-hidden />
                            <span className="flex shrink-0 items-center gap-1.5">
                                <span className="font-medium text-gray-400 dark:text-gray-500">Gender</span>
                                <span className={HEADER_VALUE_BADGE_CLASS}>{patient.sex}</span>
                            </span>
                            <span className="hidden h-3 w-px bg-gray-200 dark:bg-white/10 sm:inline" aria-hidden />
                            <span className="flex min-w-0 max-w-full items-center gap-1.5 truncate" title={bedDisplay}>
                                <span className="shrink-0 font-medium text-gray-400 dark:text-gray-500">Bed</span>
                                <span className={`${HEADER_VALUE_BADGE_CLASS} min-w-0 max-w-[min(100%,14rem)]`}>
                                    {bedDisplay}
                                </span>
                            </span>
                        </div>
                    </div>

                    <EncounterActionButtons
                        admitted={admitted}
                        dischargeInitiated={!!session?.dischargeInitiated}
                        bedReadyForDischarge={bedReadyForDischarge}
                        transferBlockedNoBeds={transferBlockedNoBeds}
                        bedsFetchError={bedsQuery.isError}
                        onOpenAdt={setAdtModal}
                        onStartDischarge={goDischargeReadiness}
                    />
                </div>
            </header>

            {adtModal ? (
                <AdtPatientWorkflowModal
                    open
                    patientId={patient.id}
                    patientLabel={patient.fullName}
                    intent={adtModal.intent}
                    onClose={() => setAdtModal(null)}
                    facesheetPatientId={patient.id}
                />
            ) : null}
        </>
    );
}
