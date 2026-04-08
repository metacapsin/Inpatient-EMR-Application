import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { ChevronRight } from 'lucide-react';
import type { FacesheetPatient } from '../../services/patient.service';
import { formatLocationLine } from '../../types/patientLocation';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { fetchEmrBedList, filterAvailableBeds } from '../../services/emrBeds.service';
import { AdtPatientWorkflowModal } from '../adt/AdtPatientWorkflowModal';
import { EncounterStatusBadge } from './EncounterStatusBadge';
import { EncounterActionButtons } from './EncounterActionButtons';
import type { EncounterHeaderAdtModalState, EncounterStatusVariant } from './encounterHeaderTypes';

export interface EncounterHeaderProps {
    patient: FacesheetPatient;
    patientListHref?: string;
}

function resolveStatus(session: ReturnType<typeof selectAdtEncounter>): {
    variant: EncounterStatusVariant;
    label: string;
} {
    if (!session) {
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

    const locationLine = formatLocationLine(patient.location);
    const bedDisplay = locationLine.trim() ? locationLine : '—';

    const status = resolveStatus(session);
    const admitted = !!session;

    const transferBlockedNoBeds = admitted && bedsQuery.isSuccess && availableBeds.length === 0;

    return (
        <>
            <header
                className="sticky top-0 z-30 border-b border-gray-200/90 bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-white/10 dark:bg-[#141210]/92 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
                aria-label="Patient and encounter"
            >
                <nav
                    className="flex items-center gap-1 border-b border-gray-100/80 px-3 py-1 text-[10px] font-medium text-gray-500 dark:border-white/5 dark:text-gray-400"
                    aria-label="Breadcrumb"
                >
                    <Link to={patientListHref} className="transition-colors hover:text-primary">
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
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                            <span className="shrink-0">
                                <span className="font-medium text-gray-400 dark:text-gray-500">MRN </span>
                                <span className="font-mono font-semibold text-gray-800 dark:text-gray-100">{patient.mrn}</span>
                            </span>
                            <span className="hidden h-3 w-px bg-gray-200 dark:bg-white/10 sm:inline" aria-hidden />
                            <span className="shrink-0">
                                <span className="font-medium text-gray-400 dark:text-gray-500">Gender </span>
                                {patient.sex}
                            </span>
                            <span className="hidden h-3 w-px bg-gray-200 dark:bg-white/10 sm:inline" aria-hidden />
                            <span className="min-w-0 truncate" title={bedDisplay}>
                                <span className="font-medium text-gray-400 dark:text-gray-500">Bed </span>
                                {bedDisplay}
                            </span>
                        </div>
                    </div>

                    <EncounterActionButtons
                        admitted={admitted}
                        dischargeInitiated={!!session?.dischargeInitiated}
                        transferBlockedNoBeds={transferBlockedNoBeds}
                        bedsFetchError={bedsQuery.isError}
                        onOpenAdt={setAdtModal}
                    />
                </div>
            </header>

            {adtModal ? (
                <AdtPatientWorkflowModal
                    open
                    patientId={patient.id}
                    patientLabel={patient.fullName}
                    intent={adtModal.intent}
                    dischargeInitialStep={
                        adtModal.intent === 'discharge' ? adtModal.dischargeInitialStep : undefined
                    }
                    onClose={() => setAdtModal(null)}
                    facesheetPatientId={patient.id}
                />
            ) : null}
        </>
    );
}
