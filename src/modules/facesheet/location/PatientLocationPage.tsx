import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BedDouble, MapPin } from 'lucide-react';
import { usePatientId } from '../../../hooks/usePatientId';
import { useIsFacesheetChart } from '../../../hooks/useFacesheetChartLayout';
import { useCanEditPatientLocation } from '../../../hooks/useCanEditPatientLocation';
import type { AppDispatch, IRootState } from '../../../store';
import { updatePatientLocation } from '../../../store/facesheetSlice';
import { LocationCascadeSelects } from './LocationCascadeSelects';
import {
    assignPatientLocation,
    fetchPatientLocationAssignment,
    resolveSnapshotFromLabels,
    transferPatientLocation,
    validatePatientLocationAssignment,
} from '../../../services/patientLocation.service';
import { emptyPatientLocation, formatLocationLine } from '../../../types/patientLocation';
import type { PatientLocationSnapshot } from '../../../types/patientLocation';

function LocationFormSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
                </div>
            ))}
        </div>
    );
}

function snapshotsEqual(a: PatientLocationSnapshot, b: PatientLocationSnapshot): boolean {
    return a.wardId === b.wardId && a.roomId === b.roomId && a.bedId === b.bedId;
}

const PatientLocationPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const patientId = usePatientId();
    const isFacesheet = useIsFacesheetChart();
    const patient = useSelector((s: IRootState) => s.facesheet.patient);
    const canEdit = useCanEditPatientLocation();

    const [draft, setDraft] = useState<PatientLocationSnapshot>(() => emptyPatientLocation());
    const [baseline, setBaseline] = useState<PatientLocationSnapshot>(() => emptyPatientLocation());

    const placementQuery = useQuery({
        queryKey: ['patient-placement', patientId],
        queryFn: () => fetchPatientLocationAssignment(patientId!),
        enabled: Boolean(patientId?.trim()),
    });

    useEffect(() => {
        if (!patientId?.trim()) return;
        if (!placementQuery.isSuccess) return;

        const fromChart = patient?.location ? { ...patient.location } : emptyPatientLocation();
        const stored = placementQuery.data;
        const seed = stored != null ? stored : fromChart;
        const resolved = resolveSnapshotFromLabels(seed);
        setDraft(resolved);
        setBaseline(resolved);
    }, [patientId, placementQuery.isSuccess, placementQuery.data, patient?.location]);

    const validationError = useMemo(() => validatePatientLocationAssignment(draft), [draft]);
    const selectionValid = validationError === null;

    const hasCommittedBed = Boolean(baseline.bedId.trim());
    const selectionChanged = !snapshotsEqual(draft, baseline);

    const assignDisabled =
        !canEdit || !selectionValid || hasCommittedBed || placementQuery.isLoading || placementQuery.isFetching;
    const transferDisabled =
        !canEdit ||
        !selectionValid ||
        !hasCommittedBed ||
        !selectionChanged ||
        placementQuery.isLoading ||
        placementQuery.isFetching;

    const assignMutation = useMutation({
        mutationFn: async () => {
            if (!patientId?.trim()) throw new Error('No patient context');
            await assignPatientLocation(patientId, draft);
        },
        onSuccess: () => {
            toast.success('Bed assigned');
            dispatch(updatePatientLocation(draft));
            setBaseline(draft);
            void queryClient.invalidateQueries({ queryKey: ['patient-placement'] });
            void queryClient.invalidateQueries({ queryKey: ['facility', 'beds'] });
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Assign failed');
        },
    });

    const transferMutation = useMutation({
        mutationFn: async () => {
            if (!patientId?.trim()) throw new Error('No patient context');
            await transferPatientLocation(patientId, draft, baseline);
        },
        onSuccess: () => {
            toast.success('Bed transfer completed');
            dispatch(updatePatientLocation(draft));
            setBaseline(draft);
            void queryClient.invalidateQueries({ queryKey: ['patient-placement'] });
            void queryClient.invalidateQueries({ queryKey: ['facility', 'beds'] });
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Transfer failed');
        },
    });

    const saving = assignMutation.isPending || transferMutation.isPending;
    const placementError = placementQuery.error instanceof Error ? placementQuery.error.message : null;

    if (!patientId?.trim()) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                Open this module from a patient chart to assign a bed.
            </div>
        );
    }

    const summaryLine = formatLocationLine(draft);
    const showSkeleton = placementQuery.isLoading && !placementQuery.data;

    return (
        <div className={`space-y-6 ${isFacesheet ? 'w-full max-w-none' : 'mx-auto max-w-4xl'}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary dark:bg-primary/25">
                        <BedDouble className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Patient location</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Choose ward, then room, then bed. Occupied beds are disabled for other patients. Changes use mock ADT
                            data until backend APIs are connected.
                        </p>
                    </div>
                </div>
            </div>

            {!canEdit ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                    You have read-only access to patient location. Contact your administrator to request placement privileges.
                </div>
            ) : null}

            {placementError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
                    {placementError}
                </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200/90 bg-gray-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04] sm:px-5">
                <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            Current selection
                        </p>
                        <p className="mt-1 font-medium">
                            {placementQuery.isLoading && !summaryLine.trim()
                                ? 'Loading…'
                                : summaryLine.trim()
                                  ? summaryLine
                                  : 'No ward / room / bed selected'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <fieldset disabled={saving || !canEdit || placementQuery.isLoading} className="min-w-0 space-y-4">
                    <legend className="sr-only">Assign inpatient location</legend>
                    {showSkeleton ? (
                        <LocationFormSkeleton />
                    ) : (
                        <LocationCascadeSelects patientId={patientId} value={draft} onChange={setDraft} disabled={!canEdit} />
                    )}
                </fieldset>

                {canEdit ? (
                    <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
                        <button
                            type="button"
                            disabled={assignDisabled || saving}
                            onClick={() => assignMutation.mutate()}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {assignMutation.isPending ? 'Assigning…' : 'Assign bed'}
                        </button>
                        <button
                            type="button"
                            disabled={transferDisabled || saving}
                            onClick={() => transferMutation.mutate()}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100 dark:hover:bg-white/5 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {transferMutation.isPending ? 'Transferring…' : 'Transfer bed'}
                        </button>
                        <button
                            type="button"
                            disabled={saving || placementQuery.isLoading}
                            onClick={() => void placementQuery.refetch()}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            Refresh
                        </button>
                    </div>
                ) : null}

                {!selectionValid && canEdit && draft.wardId.trim() && draft.roomId.trim() && draft.bedId.trim() ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">{validationError}</p>
                ) : null}
            </div>
        </div>
    );
};

export default PatientLocationPage;
