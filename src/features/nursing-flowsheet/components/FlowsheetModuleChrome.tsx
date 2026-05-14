import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { Skeleton } from 'primereact/skeleton';
import type { FacesheetPatient } from '../../../services/patient.service';
import { formatPatientHeaderBedLine } from '../../../types/patientLocation';
import { useNursingFlowsheet } from '../state/NursingFlowsheetContext';

export interface FlowsheetModuleChromeProps {
    patient: FacesheetPatient | null;
    encounterId: string;
    loading?: boolean;
    onOpenShiftSwitch: () => void;
    onOpenEncounterSwitch: () => void;
}

function saveTagSeverity(s: string) {
    if (s === 'error') return 'danger' as const;
    if (s === 'saving') return 'warning' as const;
    if (s === 'dirty') return 'warning' as const;
    return 'success' as const;
}

export function FlowsheetModuleChrome({
    patient,
    encounterId,
    loading,
    onOpenShiftSwitch,
    onOpenEncounterSwitch,
}: FlowsheetModuleChromeProps) {
    const { state, openHistory } = useNursingFlowsheet();
    const { document: doc, save } = state;
    const bed = patient ? formatPatientHeaderBedLine(patient.location) : '—';

    return (
        <div className="sticky top-0 z-20 border-b border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#141210]/95">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-3 py-2 lg:px-4">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {loading && !patient ? (
                        <Skeleton width="16rem" height="1.25rem" className="!bg-gray-100 dark:!bg-white/10" />
                    ) : (
                        <>
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
                                <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                    Nursing flowsheet — head-to-toe
                                </h2>
                                <Tag
                                    value={doc.chartStatus.toUpperCase()}
                                    severity={
                                        doc.chartStatus === 'signed'
                                            ? 'success'
                                            : doc.chartStatus === 'amending'
                                              ? 'warning'
                                              : 'info'
                                    }
                                    className="!h-5 !text-[10px]"
                                />
                                {doc.chartStatus === 'amending' ? (
                                    <Tag value="AMENDMENT" severity="danger" className="!h-5 !text-[10px]" />
                                ) : null}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                                <span className="font-semibold text-gray-900 dark:text-white">{patient?.fullName ?? '—'}</span>
                                <span>MRN {patient?.mrn ?? '—'}</span>
                                <span className="truncate">Bed {bed}</span>
                                <span className="font-mono text-[10px] text-gray-500">Enc {encounterId || '—'}</span>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    <Button
                        type="button"
                        size="small"
                        label={`${doc.shiftDate} · ${doc.shiftType}`}
                        icon="pi pi-clock"
                        className="!py-1 !text-[11px]"
                        outlined
                        onClick={onOpenShiftSwitch}
                    />
                    <Button
                        type="button"
                        size="small"
                        label="Encounter"
                        icon="pi pi-link"
                        className="!py-1 !text-[11px]"
                        outlined
                        onClick={onOpenEncounterSwitch}
                    />
                    <Tag
                        value={
                            save.status === 'saved' && save.lastSavedAtIso
                                ? `Saved ${new Date(save.lastSavedAtIso).toLocaleTimeString()}`
                                : save.status.toUpperCase()
                        }
                        severity={saveTagSeverity(save.status)}
                        className="!max-w-[10rem] !truncate !text-[10px]"
                    />
                    <Button
                        type="button"
                        size="small"
                        icon="pi pi-history"
                        className="!h-8 !w-8"
                        rounded
                        outlined
                        onClick={openHistory}
                        aria-label="Version history"
                    />
                </div>
            </div>
            <Divider className="!m-0" />
        </div>
    );
}
