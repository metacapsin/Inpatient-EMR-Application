import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BedDouble, MapPin } from 'lucide-react';
import { usePatientId } from '../../../hooks/usePatientId';
import { useIsFacesheetChart } from '../../../hooks/useFacesheetChartLayout';
import { useCanEditPatientLocation } from '../../../hooks/useCanEditPatientLocation';
import type { AppDispatch, IRootState } from '../../../store';
import { fetchFacesheetPatient } from '../../../store/facesheetSlice';
import { selectAdtEncounter } from '../../../store/adtEncounterSlice';
import { fetchEmrBedList, formatBedHeaderLine } from '../../../services/emrBeds.service';
import { bedOptionsForSelect } from '../../../lib/adtBedPicker';
import { formatAdtUserMessage, transferPatient } from '../../../services/adtWorkflowService';
import { formatLocationLine } from '../../../types/patientLocation';
import { LabeledDropdown } from '../../../components/shared/LabeledDropdown';
import { PlacementWarningsBanner } from '../../../components/adt/PlacementWarningsBanner';

/**
 * Patient location: read model comes from the active encounter (server), and the only write path is
 * the ADT transfer endpoint (`POST /api/transfers`). Bed assignment for a patient who is not admitted
 * happens through admission on the ADT tab, so there is no client-side placement store anymore.
 */
const PatientLocationPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const patientId = usePatientId();
    const isFacesheet = useIsFacesheetChart();
    const canEdit = useCanEditPatientLocation();
    const patient = useSelector((s: IRootState) => s.facesheet.patient);
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));

    const [targetBedId, setTargetBedId] = useState('');
    const [reason, setReason] = useState('');
    const [submitError, setSubmitError] = useState<string | null>(null);

    const admitted = Boolean(session?.encounterId?.trim());
    const currentBedId = session?.currentBedMongoId?.trim() ?? '';

    const bedsQuery = useQuery({
        queryKey: ['beds', 'emr-list'],
        queryFn: fetchEmrBedList,
        staleTime: 15_000,
        enabled: admitted && canEdit,
    });
    const beds = bedsQuery.data ?? [];

    const transferOptions = useMemo(
        () => bedOptionsForSelect(beds, { onlyAvailable: true, excludeId: currentBedId || undefined }),
        [beds, currentBedId]
    );

    const currentBedLabel = useMemo(() => {
        const fromBeds = currentBedId ? beds.find((b) => b.id === currentBedId) : undefined;
        if (fromBeds) return formatBedHeaderLine(fromBeds);
        return formatLocationLine(patient?.location) || '';
    }, [beds, currentBedId, patient?.location]);

    const ctx = useMemo(() => ({ dispatch, queryClient }), [dispatch, queryClient]);

    const transferMutation = useMutation({
        mutationFn: async () => {
            const pid = patientId?.trim();
            if (!pid) throw new Error('No patient context');
            if (!session?.encounterId?.trim()) throw new Error('This patient has no active admission.');
            const newBedId = targetBedId.trim();
            if (!newBedId) throw new Error('Select a destination bed.');
            if (currentBedId && newBedId === currentBedId) throw new Error('Choose a bed different from the current one.');
            return transferPatient(ctx, {
                encounterId: session.encounterId.trim(),
                newBedId,
                patientId: pid,
                ...(reason.trim() ? { reason: reason.trim() } : {}),
            });
        },
        onSuccess: (result) => {
            if (!result.ok) {
                setSubmitError(formatAdtUserMessage(result));
                return;
            }
            setSubmitError(null);
            toast.success(result.message || 'Transfer completed');
            setTargetBedId('');
            setReason('');
            if (patientId?.trim()) void dispatch(fetchFacesheetPatient(patientId.trim()));
        },
        onError: (e: unknown) => {
            setSubmitError(e instanceof Error ? e.message : 'Transfer failed');
        },
    });

    if (!patientId?.trim()) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                Open this module from a patient chart to view the bed assignment.
            </div>
        );
    }

    const base = `/app/facesheet/${encodeURIComponent(patientId.trim())}`;
    const busy = transferMutation.isPending;

    return (
        <div className={`space-y-6 ${isFacesheet ? 'w-full max-w-none' : 'mx-auto max-w-4xl'}`}>
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary dark:bg-primary/25">
                    <BedDouble className="h-5 w-5" aria-hidden />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Patient location</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Location is read from the active admission. Moving the patient records an ADT transfer, frees the
                        previous bed for housekeeping and notifies care partners.
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200/90 bg-gray-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04] sm:px-5">
                <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Current location</p>
                        <p className="mt-1 font-medium">
                            {admitted ? currentBedLabel || 'Admitted — bed not resolved yet' : 'Not admitted'}
                        </p>
                        {session?.dischargeInitiated ? (
                            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Discharge in progress; transfers are disabled.</p>
                        ) : null}
                    </div>
                </div>
            </div>

            {!admitted ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200">
                    <p>This patient has no active inpatient encounter, so there is no bed to show.</p>
                    <Link to={`${base}/adt`} className="mt-3 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                        Open ADT to admit and assign a bed
                    </Link>
                </div>
            ) : !canEdit ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
                    You have read-only access to patient location. Contact your administrator to request placement privileges.
                </div>
            ) : (
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setSubmitError(null);
                        transferMutation.mutate();
                    }}
                    aria-describedby={submitError ? 'location-transfer-error' : undefined}
                >
                    <fieldset disabled={busy || Boolean(session?.dischargeInitiated)} className="min-w-0 space-y-4">
                        <legend className="text-sm font-semibold text-gray-900 dark:text-white">Transfer to another bed</legend>
                        {bedsQuery.isError ? (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200" role="alert">
                                {bedsQuery.error instanceof Error ? bedsQuery.error.message : 'Failed to load beds'}{' '}
                                <button type="button" className="font-semibold underline" onClick={() => void bedsQuery.refetch()}>
                                    Retry
                                </button>
                            </p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <LabeledDropdown
                                    id="location-transfer-bed"
                                    label="New bed (available)"
                                    value={targetBedId || undefined}
                                    placeholder={bedsQuery.isLoading ? 'Loading beds…' : transferOptions.length ? 'Select bed' : 'No available beds'}
                                    options={transferOptions.map((o) => ({ value: o.value, label: o.label }))}
                                    onChange={(v) => {
                                        setTargetBedId(v);
                                        setSubmitError(null);
                                    }}
                                    disabled={busy || bedsQuery.isLoading}
                                />
                            </div>
                            {targetBedId.trim() ? (
                                <div className="sm:col-span-2">
                                    <PlacementWarningsBanner bedId={targetBedId.trim()} patientId={patientId.trim()} encounterId={session?.encounterId} />
                                </div>
                            ) : null}
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="location-transfer-reason">
                                    Reason (optional)
                                </label>
                                <input
                                    id="location-transfer-reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                                />
                            </div>
                        </div>
                    </fieldset>

                    {submitError ? (
                        <p id="location-transfer-error" role="alert" className="text-sm text-red-700 dark:text-red-300">
                            {submitError}
                        </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
                        <button
                            type="submit"
                            disabled={busy || !targetBedId.trim() || Boolean(session?.dischargeInitiated)}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {busy ? 'Transferring…' : 'Transfer bed'}
                        </button>
                        <button
                            type="button"
                            disabled={busy || bedsQuery.isFetching}
                            onClick={() => void bedsQuery.refetch()}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            Refresh beds
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default PatientLocationPage;
