import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Hospital } from 'lucide-react';
import { usePatientId } from '../../../hooks/usePatientId';
import type { AdmissionType } from '../../../types/adt';
import {
    activeEncounterRowsToAdtMergePayload,
    adtApi,
    formatAdtUserMessage,
    hasValidAdtBedForDischarge,
    listActiveEncounters,
    resolveBedMongoIdAfterAdmit,
} from '../../../services/adt.service';
import { fetchEmrBedList, filterAvailableBeds, type EmrBedListItem } from '../../../services/emrBeds.service';
import { LabeledDropdown } from '../../../components/shared/LabeledDropdown';
import { AppModal } from '../../../components/shared/AppModal';
import { bedOptionsForSelect, bedStatusIndicatorClass } from '../../../lib/adtBedPicker';
import { AdtPatientQuickSearch } from '../../../components/adt/AdtPatientQuickSearch';
import type { AppDispatch, IRootState } from '../../../store';
import { fetchFacesheetPatient } from '../../../store/facesheetSlice';
import {
    clearAdtEncounter,
    mergeActiveEncountersFromServer,
    selectAdtEncounter,
    setAdtAfterAdmit,
    setAdtCurrentBed,
    setAdtDischargeInitiated,
    setAdtEncounter,
} from '../../../store/adtEncounterSlice';

const ADMISSION_TYPES: { value: AdmissionType; label: string }[] = [
    { value: 'emergency', label: 'Emergency' },
    { value: 'elective', label: 'Elective' },
    { value: 'urgent', label: 'Urgent' },
];

const FACESHEET_ADT_PATH = /\/app\/facesheet\/[^/]+\/adt$/;
const BED_BOARD_PATH = '/app/bed-board';

function BedStatusLegend({ beds }: { beds: EmrBedListItem[] }) {
    const counts = useMemo(() => {
        let avail = 0;
        let occ = 0;
        let other = 0;
        for (const b of beds) {
            const s = b.bedStatus.trim().toLowerCase();
            if (s === '' || s === 'available') avail += 1;
            else if (s === 'occupied' || s === 'assigned' || s === 'held') occ += 1;
            else other += 1;
        }
        return { avail, occ, other, total: beds.length };
    }, [beds]);

    if (!beds.length) return null;

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200/80 bg-white/60 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
            <span className="font-semibold text-gray-500 dark:text-gray-400">Beds ({counts.total})</span>
            <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${bedStatusIndicatorClass('available')}`} aria-hidden />
                Available {counts.avail}
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${bedStatusIndicatorClass('occupied')}`} aria-hidden />
                Occupied {counts.occ}
            </span>
            {counts.other ? (
                <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${bedStatusIndicatorClass('other')}`} aria-hidden />
                    Other {counts.other}
                </span>
            ) : null}
        </div>
    );
}

const AdtModulePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isFacesheetAdt = FACESHEET_ADT_PATH.test(location.pathname);
    const patientId = usePatientId();
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));
    const adtSession = session?.encounterId?.trim() ? session : null;

    useEffect(() => {
        if (isFacesheetAdt) return;
        const pid = patientId?.trim();
        if (!pid) return;
        let cancelled = false;
        void (async () => {
            const res = await listActiveEncounters({ patientId: pid });
            if (cancelled || !res.ok) return;
            dispatch(mergeActiveEncountersFromServer(activeEncounterRowsToAdtMergePayload(res.data)));
        })();
        return () => {
            cancelled = true;
        };
    }, [isFacesheetAdt, patientId, dispatch]);

    const [admitBedId, setAdmitBedId] = useState<string>('');
    const [admissionType, setAdmissionType] = useState<AdmissionType | ''>('');
    const [sourceOfAdmission, setSourceOfAdmission] = useState('');
    const [attendingPhysicianId, setAttendingPhysicianId] = useState('');
    const [diagnosis, setDiagnosis] = useState('');

    const [transferBedId, setTransferBedId] = useState('');
    const [transferReason, setTransferReason] = useState('');

    const [disposition, setDisposition] = useState('');
    const [dischargeSummary, setDischargeSummary] = useState('');
    const [confirmDischargeOpen, setConfirmDischargeOpen] = useState(false);

    const [manualEncounterId, setManualEncounterId] = useState('');
    const [showManualEncounter, setShowManualEncounter] = useState(false);

    const bedsQuery = useQuery({
        queryKey: ['beds', 'emr-list'],
        queryFn: fetchEmrBedList,
        staleTime: 0,
        refetchOnMount: 'always',
    });

    const beds = bedsQuery.data ?? [];
    const availableBeds = useMemo(() => filterAvailableBeds(beds), [beds]);

    const admitTargetBedId = admitBedId.trim();
    const transferTargetBedId = transferBedId.trim();
    const currentBedId = adtSession?.currentBedMongoId?.trim() ?? '';
    const transferSameBed =
        !!transferTargetBedId.trim() && transferTargetBedId.trim() === currentBedId && currentBedId !== '';

    const refreshPatient = () => {
        const pid = patientId?.trim();
        if (pid) void dispatch(fetchFacesheetPatient(pid));
        void queryClient.invalidateQueries({ queryKey: ['beds', 'emr-list'] });
        void queryClient.invalidateQueries({ queryKey: ['patient-placement'] });
        void queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] });
        void queryClient.invalidateQueries({ queryKey: ['facility'] });
        void queryClient.invalidateQueries({ queryKey: ['liveBedBoard'] });
        void queryClient.invalidateQueries({ queryKey: ['activeEncounters'] });
    };

    const admitMutation = useMutation({
        mutationFn: async () => {
            if (!patientId?.trim()) throw new Error('No patient in context');
            const bedId = admitTargetBedId.trim();
            if (!bedId) throw new Error('Select an available bed for admission.');
            const body = {
                patientId: patientId.trim(),
                bedId,
                ...(admissionType ? { admissionType } : {}),
                ...(sourceOfAdmission.trim() ? { sourceOfAdmission: sourceOfAdmission.trim() } : {}),
                ...(attendingPhysicianId.trim() ? { attendingPhysicianId: attendingPhysicianId.trim() } : {}),
                ...(diagnosis.trim() ? { diagnosis: diagnosis.trim() } : {}),
            };
            return adtApi.admit(body);
        },
        onSuccess: (result) => {
            if (!patientId?.trim()) return;
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            const encId = result.data.encounter?.id;
            if (!encId) {
                toast.error('Admission succeeded but no encounter id was returned.');
                return;
            }
            const encObj = result.data.encounter as Record<string, unknown> | undefined;
            const bedMongoId = resolveBedMongoIdAfterAdmit(encObj, admitTargetBedId.trim());
            dispatch(
                setAdtAfterAdmit({
                    patientId: patientId.trim(),
                    encounterId: encId,
                    bedMongoId,
                })
            );
            toast.success(result.message || 'Patient admitted');
            refreshPatient();
            navigate(BED_BOARD_PATH);
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Admission failed');
        },
    });

    const transferMutation = useMutation({
        mutationFn: async () => {
            if (!adtSession?.encounterId) throw new Error('No active encounter in this workspace');
            const newBedId = transferTargetBedId.trim();
            if (!newBedId) throw new Error('Select an available destination bed.');
            if (adtSession.currentBedMongoId && newBedId === adtSession.currentBedMongoId.trim()) {
                throw new Error('Choose a different bed than the current assignment.');
            }
            return adtApi.transfer({
                encounterId: adtSession.encounterId,
                newBedId,
                ...(transferReason.trim() ? { reason: transferReason.trim() } : {}),
            });
        },
        onSuccess: (result) => {
            if (!patientId?.trim()) return;
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            const nextBed = result.data.currentBedId?.trim() || transferTargetBedId.trim();
            if (nextBed) {
                dispatch(
                    setAdtCurrentBed({
                        patientId: patientId.trim(),
                        bedMongoId: nextBed,
                        fromTransfer: true,
                    })
                );
            }
            toast.success(result.message || 'Transfer completed');
            setTransferBedId('');
            setTransferReason('');
            refreshPatient();
            navigate(BED_BOARD_PATH);
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Transfer failed');
        },
    });

    const dischargeInitMutation = useMutation({
        mutationFn: async () => {
            const encounterId = adtSession?.encounterId;
            if (!encounterId) throw new Error('No active encounter in this workspace');
            if (!hasValidAdtBedForDischarge(adtSession)) {
                throw new Error(
                    'No bed is linked to this encounter in the workspace. Refresh the chart or open the patient from the bed board, then try again.'
                );
            }
            console.info('[adt] discharge initiate request', {
                encounterId,
                currentBedMongoId: adtSession.currentBedMongoId?.trim() ?? null,
            });
            const result = await adtApi.dischargeInitiate(
                encounterId,
                disposition.trim() || undefined,
                dischargeSummary.trim() || undefined
            );
            return { result, encounterId };
        },
        onSuccess: ({ result, encounterId }) => {
            if (!patientId?.trim()) return;
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            dispatch(setAdtDischargeInitiated({ patientId: patientId.trim(), encounterId }));
            toast.success(result.message || 'Discharge initiated');
            refreshPatient();
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Could not initiate discharge');
        },
    });

    const dischargeConfirmMutation = useMutation({
        mutationFn: async () => {
            if (!adtSession?.encounterId) throw new Error('No active encounter in this workspace');
            console.info('[adt] discharge confirm request', {
                encounterId: adtSession.encounterId,
                currentBedMongoId: adtSession.currentBedMongoId?.trim() ?? null,
            });
            return adtApi.dischargeConfirm(adtSession.encounterId);
        },
        onSuccess: (result) => {
            if (!patientId?.trim()) return;
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            dispatch(clearAdtEncounter({ patientId: patientId.trim() }));
            setConfirmDischargeOpen(false);
            setDisposition('');
            setDischargeSummary('');
            toast.success(result.message || 'Discharge confirmed');
            refreshPatient();
            navigate(BED_BOARD_PATH);
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Could not confirm discharge');
        },
    });

    const applyManualEncounter = () => {
        const id = manualEncounterId.trim();
        if (!id) {
            toast.error('Enter an encounter id');
            return;
        }
        if (!patientId?.trim()) return;
        dispatch(
            setAdtEncounter({
                patientId: patientId.trim(),
                encounter: { encounterId: id, dischargeInitiated: false, currentBedMongoId: null },
            })
        );
        setManualEncounterId('');
        setShowManualEncounter(false);
        toast.message('Encounter linked for this workspace');
    };

    const forgetEncounter = () => {
        if (!patientId?.trim()) return;
        dispatch(clearAdtEncounter({ patientId: patientId.trim() }));
        toast.message('Cleared encounter from workspace');
    };

    if (!patientId?.trim()) {
        return (
            <div className="space-y-6">
                <div className="max-w-md">
                    <AdtPatientQuickSearch currentPatientId={null} />
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                    Search for a patient above, open <strong>ADT</strong> from the main menu, or open a facesheet to run ADT actions.
                </div>
            </div>
        );
    }

    const bedsError = bedsQuery.error instanceof Error ? bedsQuery.error.message : null;
    const admitOptions = bedOptionsForSelect(beds, { onlyAvailable: true });
    const transferOptions = bedOptionsForSelect(beds, { onlyAvailable: true, excludeId: currentBedId || undefined });

    const bedReadyForDischarge = hasValidAdtBedForDischarge(adtSession);

    const busy =
        admitMutation.isPending ||
        transferMutation.isPending ||
        dischargeInitMutation.isPending ||
        dischargeConfirmMutation.isPending;

    const sectionClass =
        'space-y-3 border-b border-gray-100 pb-6 last:border-b-0 last:pb-0 dark:border-white/[0.08]';

    return (
        <div className="w-full max-w-none space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary dark:bg-primary/20">
                        <Hospital className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">ADT workspace</h2>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            Encounter state is stored in this browser (Redux). Use the chart header for quick admit / transfer / discharge.
                        </p>
                    </div>
                </div>
                {!isFacesheetAdt ? (
                    <div className="w-full shrink-0 sm:max-w-xs sm:pt-0.5">
                        <AdtPatientQuickSearch currentPatientId={patientId} />
                    </div>
                ) : null}
            </div>

            <BedStatusLegend beds={beds} />

            {bedsError ? (
                <div className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100">
                    Bed list could not be loaded ({bedsError}). You can still paste MongoDB bed ids below if you know them.
                </div>
            ) : null}

            <div className="rounded-lg border border-gray-200/80 bg-gray-50/60 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="min-w-0 text-xs text-gray-600 dark:text-gray-300">
                        {adtSession ? (
                            <>
                                <span className="font-medium text-gray-800 dark:text-gray-100">Encounter</span>{' '}
                                <span className="font-mono text-[11px]">{adtSession.encounterId}</span>
                                {adtSession.dischargeInitiated ? (
                                    <span className="ml-2 inline-flex rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                                        Discharge pending confirm
                                    </span>
                                ) : adtSession.lastPlacementAction === 'transfer' ? (
                                    <span className="ml-2 inline-flex rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
                                        Transferred
                                    </span>
                                ) : null}
                            </>
                        ) : (
                            <span className="text-gray-500 dark:text-gray-400">No encounter linked — admit below or link an id.</span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busy || bedsQuery.isFetching}
                            onClick={() => void bedsQuery.refetch()}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            {bedsQuery.isFetching ? 'Refreshing…' : 'Refresh beds'}
                        </button>
                        <button
                            type="button"
                            disabled={busy || !adtSession}
                            onClick={forgetEncounter}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            Clear encounter
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setShowManualEncounter((v) => !v)}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-dashed border-primary/35 bg-primary/5 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10"
                        >
                            {showManualEncounter ? 'Hide link' : 'Link encounter id'}
                        </button>
                    </div>
                </div>
                {showManualEncounter ? (
                    <div className="mt-3 flex flex-col gap-2 border-t border-gray-200/80 pt-3 dark:border-white/10 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-200" htmlFor="adt-manual-encounter">
                                Encounter id (Mongo _id)
                            </label>
                            <input
                                id="adt-manual-encounter"
                                value={manualEncounterId}
                                onChange={(e) => setManualEncounterId(e.target.value)}
                                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                                placeholder="Paste encounter id"
                            />
                        </div>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={applyManualEncounter}
                            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                        >
                            Save
                        </button>
                    </div>
                ) : null}
            </div>

            {!adtSession ? (
                <section className={sectionClass}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Admit</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Choose an available bed from the list. One active encounter per patient in this workspace.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <LabeledDropdown
                                id="adt-admit-bed"
                                label="Bed (available)"
                                value={admitBedId || undefined}
                                placeholder={
                                    bedsQuery.isLoading
                                        ? 'Loading beds…'
                                        : availableBeds.length
                                          ? 'Select bed'
                                          : 'No available beds in list'
                                }
                                options={admitOptions.map((o) => ({ value: o.value, label: o.label }))}
                                onChange={setAdmitBedId}
                                disabled={busy || bedsQuery.isLoading}
                                aria-busy={bedsQuery.isFetching}
                            />
                        </div>
                        <LabeledDropdown
                            id="adt-admission-type"
                            label="Admission type (optional)"
                            value={admissionType || undefined}
                            placeholder="Any"
                            options={ADMISSION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                            onChange={(v) => setAdmissionType(v as AdmissionType)}
                            disabled={busy}
                        />
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="adt-source">
                                Source of admission (optional)
                            </label>
                            <input
                                id="adt-source"
                                value={sourceOfAdmission}
                                onChange={(e) => setSourceOfAdmission(e.target.value)}
                                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="adt-attending">
                                Attending physician id (optional)
                            </label>
                            <input
                                id="adt-attending"
                                value={attendingPhysicianId}
                                onChange={(e) => setAttendingPhysicianId(e.target.value)}
                                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="adt-diagnosis">
                                Diagnosis (optional)
                            </label>
                            <input
                                id="adt-diagnosis"
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={busy || !admitTargetBedId.trim()}
                        onClick={() => admitMutation.mutate()}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {admitMutation.isPending ? 'Admitting…' : 'Admit patient'}
                    </button>
                </section>
            ) : (
                <>
                    <section className={sectionClass}>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transfer</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Destination must be available. Occupied beds are excluded when the current bed is known.
                        </p>
                        {adtSession.dischargeInitiated ? (
                            <p className="text-sm text-amber-800 dark:text-amber-200">Complete or confirm discharge before transferring.</p>
                        ) : null}
                        {transferSameBed ? (
                            <p className="text-sm text-red-700 dark:text-red-300">Select a bed different from the current assignment.</p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <LabeledDropdown
                                    id="adt-transfer-bed"
                                    label="New bed (available)"
                                    value={transferBedId || undefined}
                                    placeholder={
                                        bedsQuery.isLoading
                                            ? 'Loading beds…'
                                            : transferOptions.length
                                              ? 'Select bed'
                                              : 'No available beds in list'
                                    }
                                    options={transferOptions.map((o) => ({ value: o.value, label: o.label }))}
                                    onChange={setTransferBedId}
                                    disabled={busy || bedsQuery.isLoading || adtSession.dischargeInitiated}
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="adt-transfer-reason">
                                    Reason (optional)
                                </label>
                                <input
                                    id="adt-transfer-reason"
                                    value={transferReason}
                                    onChange={(e) => setTransferReason(e.target.value)}
                                    disabled={adtSession.dischargeInitiated}
                                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled={busy || !transferTargetBedId.trim() || adtSession.dischargeInitiated || transferSameBed}
                            onClick={() => transferMutation.mutate()}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/5 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {transferMutation.isPending ? 'Transferring…' : 'Transfer'}
                        </button>
                    </section>

                    <section className={sectionClass}>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Discharge</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Initiate discharge, then confirm to complete. Confirm stays disabled until initiate succeeds.
                        </p>
                        {!adtSession.dischargeInitiated && !bedReadyForDischarge ? (
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                A bed must be linked to this encounter before discharge (sync from the chart header, patient list, or bed
                                board). Manual encounter links do not include a bed until the server reports one.
                            </p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="adt-disposition">
                                    Disposition (optional)
                                </label>
                                <input
                                    id="adt-disposition"
                                    value={disposition}
                                    onChange={(e) => setDisposition(e.target.value)}
                                    disabled={adtSession.dischargeInitiated || busy}
                                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm disabled:opacity-60 dark:border-white/12 dark:bg-[#1a1816]"
                                    placeholder="e.g. home"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="adt-summary">
                                    Discharge summary (optional)
                                </label>
                                <textarea
                                    id="adt-summary"
                                    value={dischargeSummary}
                                    onChange={(e) => setDischargeSummary(e.target.value)}
                                    disabled={adtSession.dischargeInitiated || busy}
                                    rows={3}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-white/12 dark:bg-[#1a1816]"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={busy || adtSession.dischargeInitiated || !bedReadyForDischarge}
                                onClick={() => dischargeInitMutation.mutate()}
                                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
                            >
                                {dischargeInitMutation.isPending ? 'Working…' : 'Initiate discharge'}
                            </button>
                            <button
                                type="button"
                                disabled={busy || !adtSession.dischargeInitiated}
                                onClick={() => setConfirmDischargeOpen(true)}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-900 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
                            >
                                Confirm discharge
                            </button>
                        </div>
                    </section>
                </>
            )}

            <AppModal
                open={confirmDischargeOpen}
                onClose={() => !dischargeConfirmMutation.isPending && setConfirmDischargeOpen(false)}
                title="Confirm discharge"
                description="This releases the bed and completes the encounter on the server. This action cannot be undone from this screen."
                size="sm"
                footer={
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            disabled={dischargeConfirmMutation.isPending}
                            onClick={() => setConfirmDischargeOpen(false)}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={dischargeConfirmMutation.isPending}
                            onClick={() => dischargeConfirmMutation.mutate()}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                        >
                            {dischargeConfirmMutation.isPending ? 'Confirming…' : 'Confirm discharge'}
                        </button>
                    </div>
                }
            >
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Encounter <span className="font-mono text-xs">{session?.encounterId}</span>
                </p>
            </AppModal>
        </div>
    );
};

export default AdtModulePage;
