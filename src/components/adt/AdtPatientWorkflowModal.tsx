import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { AppModal } from '../shared/AppModal';
import { LabeledDropdown } from '../shared/LabeledDropdown';
import { adtApi, formatAdtUserMessage } from '../../services/adt.service';
import { fetchEmrBedList } from '../../services/emrBeds.service';
import { bedOptionsForSelect } from '../../lib/adtBedPicker';
import type { AdmissionType } from '../../types/adt';
import type { AppDispatch, IRootState } from '../../store';
import { fetchFacesheetPatient } from '../../store/facesheetSlice';
import {
    clearAdtEncounter,
    selectAdtEncounter,
    setAdtAfterAdmit,
    setAdtCurrentBed,
    setAdtDischargeInitiated,
} from '../../store/adtEncounterSlice';

export type AdtWorkflowIntent = 'admit' | 'transfer' | 'discharge';

const ADMISSION_TYPES: { value: AdmissionType; label: string }[] = [
    { value: 'emergency', label: 'Emergency' },
    { value: 'elective', label: 'Elective' },
    { value: 'urgent', label: 'Urgent' },
];

export interface AdtPatientWorkflowModalProps {
    open: boolean;
    patientId: string;
    patientLabel: string;
    intent: AdtWorkflowIntent;
    onClose: () => void;
    /** Refetch list or other UI after a successful mutation */
    onCompleted?: () => void;
    /** When true, refetch facesheet patient if IDs match */
    facesheetPatientId?: string | null;
    /** When intent is discharge, which step to show first */
    dischargeInitialStep?: 'initiate' | 'confirm';
}

export function AdtPatientWorkflowModal({
    open,
    patientId,
    patientLabel,
    intent,
    onClose,
    onCompleted,
    facesheetPatientId,
    dischargeInitialStep,
}: AdtPatientWorkflowModalProps) {
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));

    const [admitBedId, setAdmitBedId] = useState('');
    const [admissionType, setAdmissionType] = useState<AdmissionType | ''>('');

    const [transferBedId, setTransferBedId] = useState('');
    const [transferReason, setTransferReason] = useState('');

    const [disposition, setDisposition] = useState('');
    const [dischargeSummary, setDischargeSummary] = useState('');
    const [dischargeStep, setDischargeStep] = useState<'initiate' | 'confirm'>('initiate');

    const bedsQuery = useQuery({
        queryKey: ['beds', 'emr-list'],
        queryFn: fetchEmrBedList,
        staleTime: 0,
        refetchOnMount: 'always',
        enabled: open,
    });

    const beds = bedsQuery.data ?? [];

    const admitTargetBedId = admitBedId.trim();
    const transferTargetBedId = transferBedId.trim();
    const currentBedId = session?.currentBedMongoId?.trim() ?? '';

    const transferSameBed =
        !!transferTargetBedId.trim() && transferTargetBedId.trim() === currentBedId && currentBedId !== '';

    const admitOptions = useMemo(() => bedOptionsForSelect(beds, { onlyAvailable: true }), [beds]);
    const transferOptions = useMemo(
        () => bedOptionsForSelect(beds, { onlyAvailable: true, excludeId: currentBedId || undefined }),
        [beds, currentBedId]
    );

    useEffect(() => {
        if (!open) return;
        setAdmitBedId('');
        setAdmissionType('');
        setTransferBedId('');
        setTransferReason('');
        setDisposition('');
        setDischargeSummary('');
        if (intent !== 'discharge') {
            setDischargeStep('initiate');
            return;
        }
        if (dischargeInitialStep) {
            setDischargeStep(dischargeInitialStep);
            return;
        }
        setDischargeStep(session?.dischargeInitiated ? 'confirm' : 'initiate');
    }, [open, intent, session?.dischargeInitiated, dischargeInitialStep]);

    const refreshChart = () => {
        const pid = patientId.trim();
        if (facesheetPatientId?.trim() === pid) {
            void dispatch(fetchFacesheetPatient(pid));
        }
        void queryClient.invalidateQueries({ queryKey: ['beds', 'emr-list'] });
        void queryClient.invalidateQueries({ queryKey: ['patient-placement'] });
        void queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] });
        void queryClient.invalidateQueries({ queryKey: ['facility'] });
        onCompleted?.();
    };

    const admitMutation = useMutation({
        mutationFn: async () => {
            const pid = patientId.trim();
            if (!pid) throw new Error('No patient selected');
            const bedId = admitTargetBedId.trim();
            if (!bedId) throw new Error('Select an available bed for admission.');
            const body = {
                patientId: pid,
                bedId,
                ...(admissionType ? { admissionType } : {}),
            };
            return adtApi.admit(body);
        },
        onSuccess: (result) => {
            const pid = patientId.trim();
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            const encId = result.data.encounter?.id;
            if (!encId) {
                toast.error('Admission succeeded but no encounter id was returned.');
                return;
            }
            dispatch(
                setAdtAfterAdmit({
                    patientId: pid,
                    encounterId: encId,
                    bedMongoId: admitTargetBedId.trim(),
                })
            );
            toast.success(result.message || 'Patient admitted');
            refreshChart();
            onClose();
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Admission failed');
        },
    });

    const transferMutation = useMutation({
        mutationFn: async () => {
            if (!session?.encounterId) throw new Error('No active encounter for this patient');
            const newBedId = transferTargetBedId.trim();
            if (!newBedId) throw new Error('Select an available destination bed.');
            if (session.currentBedMongoId && newBedId === session.currentBedMongoId.trim()) {
                throw new Error('Choose a different bed than the current assignment.');
            }
            return adtApi.transfer({
                encounterId: session.encounterId,
                newBedId,
                ...(transferReason.trim() ? { reason: transferReason.trim() } : {}),
            });
        },
        onSuccess: (result) => {
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            const pid = patientId.trim();
            const nextBed = result.data.currentBedId?.trim() || transferTargetBedId.trim();
            if (nextBed) {
                dispatch(setAdtCurrentBed({ patientId: pid, bedMongoId: nextBed, fromTransfer: true }));
            }
            toast.success(result.message || 'Transfer completed');
            refreshChart();
            onClose();
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Transfer failed');
        },
    });

    const dischargeInitMutation = useMutation({
        mutationFn: async () => {
            const encounterId = session?.encounterId;
            if (!encounterId) throw new Error('No active encounter for this patient');
            return adtApi.dischargeInitiate(
                encounterId,
                disposition.trim() || undefined,
                dischargeSummary.trim() || undefined
            );
        },
        onSuccess: (result) => {
            const pid = patientId.trim();
            const enc = session?.encounterId;
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            if (enc) {
                dispatch(setAdtDischargeInitiated({ patientId: pid, encounterId: enc }));
            }
            toast.success(result.message || 'Discharge initiated');
            setDischargeStep('confirm');
            refreshChart();
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Could not initiate discharge');
        },
    });

    const dischargeConfirmMutation = useMutation({
        mutationFn: async () => {
            if (!session?.encounterId) throw new Error('No active encounter for this patient');
            return adtApi.dischargeConfirm(session.encounterId);
        },
        onSuccess: (result) => {
            const pid = patientId.trim();
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            dispatch(clearAdtEncounter({ patientId: pid }));
            toast.success(result.message || 'Discharge confirmed');
            refreshChart();
            onClose();
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Could not confirm discharge');
        },
    });

    const busy =
        admitMutation.isPending ||
        transferMutation.isPending ||
        dischargeInitMutation.isPending ||
        dischargeConfirmMutation.isPending;

    const title =
        intent === 'admit' ? 'Admit patient' : intent === 'transfer' ? 'Transfer patient' : 'Discharge patient';

    const bedsError = bedsQuery.error instanceof Error ? bedsQuery.error.message : null;

    const admitBlocked = !!session;
    const transferBlocked = !session || session.dischargeInitiated;
    const dischargeBlocked = !session;

    return (
        <AppModal
            open={open}
            onClose={() => !busy && onClose()}
            title={title}
            description={patientLabel}
            size={intent === 'discharge' ? 'md' : 'md'}
            footer={
                intent === 'admit' ? (
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onClose}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={busy || !admitTargetBedId.trim() || admitBlocked}
                            onClick={() => admitMutation.mutate()}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {admitMutation.isPending ? 'Admitting…' : 'Admit'}
                        </button>
                    </div>
                ) : intent === 'transfer' ? (
                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onClose}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={busy || !transferTargetBedId.trim() || transferBlocked || transferSameBed}
                            onClick={() => transferMutation.mutate()}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {transferMutation.isPending ? 'Transferring…' : 'Transfer'}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                        {dischargeStep === 'confirm' ? (
                            <>
                                {!session?.dischargeInitiated ? (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => setDischargeStep('initiate')}
                                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100"
                                    >
                                        Back
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    disabled={busy || dischargeBlocked}
                                    onClick={() => dischargeConfirmMutation.mutate()}
                                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
                                >
                                    {dischargeConfirmMutation.isPending ? 'Confirming…' : 'Confirm discharge'}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={onClose}
                                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 dark:border-white/15 dark:bg-[#1a2332] dark:text-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={busy || dischargeBlocked || !!session?.dischargeInitiated}
                                    onClick={() => dischargeInitMutation.mutate()}
                                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 disabled:pointer-events-none disabled:opacity-50"
                                >
                                    {dischargeInitMutation.isPending ? 'Working…' : 'Begin discharge'}
                                </button>
                            </>
                        )}
                    </div>
                )
            }
        >
            <div className="space-y-4">
                {bedsError ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                        Bed list unavailable: {bedsError}. Fix the connection or try again.
                    </p>
                ) : null}

                {intent === 'admit' && admitBlocked ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        This patient already has an active encounter in this workspace. Transfer or discharge before admitting
                        again.
                    </p>
                ) : null}

                {intent === 'transfer' && transferBlocked ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        {session?.dischargeInitiated
                            ? 'Discharge is in progress — complete or cancel discharge before transferring.'
                            : 'Admit the patient or link an encounter before transferring.'}
                    </p>
                ) : null}

                {intent === 'discharge' && dischargeBlocked ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        No active encounter for this patient. Admit from the patient list or ADT module first.
                    </p>
                ) : null}

                {transferSameBed ? (
                    <p className="text-sm text-red-700 dark:text-red-300">Select a bed different from the current assignment.</p>
                ) : null}

                {intent === 'admit' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <LabeledDropdown
                                id="modal-adt-admit-bed"
                                label="Bed (available)"
                                value={admitBedId || undefined}
                                placeholder={
                                    bedsQuery.isLoading
                                        ? 'Loading beds…'
                                        : admitOptions.length
                                          ? 'Select bed'
                                          : 'No available beds'
                                }
                                options={admitOptions.map((o) => ({ value: o.value, label: o.label }))}
                                onChange={setAdmitBedId}
                                disabled={busy || bedsQuery.isLoading || admitBlocked}
                            />
                        </div>
                        <LabeledDropdown
                            id="modal-adt-admission-type"
                            label="Admission type (optional)"
                            value={admissionType || undefined}
                            placeholder="Any"
                            options={ADMISSION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                            onChange={(v) => setAdmissionType(v as AdmissionType)}
                            disabled={busy || admitBlocked}
                        />
                    </div>
                ) : null}

                {intent === 'transfer' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <LabeledDropdown
                                id="modal-adt-transfer-bed"
                                label="New bed (available)"
                                value={transferBedId || undefined}
                                placeholder={
                                    bedsQuery.isLoading
                                        ? 'Loading beds…'
                                        : transferOptions.length
                                          ? 'Select bed'
                                          : 'No available beds'
                                }
                                options={transferOptions.map((o) => ({ value: o.value, label: o.label }))}
                                onChange={setTransferBedId}
                                disabled={busy || bedsQuery.isLoading || transferBlocked}
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="modal-transfer-reason">
                                Reason (optional)
                            </label>
                            <input
                                id="modal-transfer-reason"
                                value={transferReason}
                                onChange={(e) => setTransferReason(e.target.value)}
                                disabled={transferBlocked}
                                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm dark:border-white/15 dark:bg-[#1a2332]"
                            />
                        </div>
                    </div>
                ) : null}

                {intent === 'discharge' ? (
                    <div className="space-y-3">
                        {dischargeStep === 'confirm' ? (
                            <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
                                <p className="font-semibold">Step 2 — Confirm discharge</p>
                                <p className="mt-1 text-red-800/90 dark:text-red-200">
                                    This completes the encounter and releases the bed on the server. This cannot be undone from this
                                    screen.
                                </p>
                                {session?.encounterId ? (
                                    <p className="mt-2 font-mono text-xs opacity-80">Encounter {session.encounterId}</p>
                                ) : null}
                            </div>
                        ) : (
                            <>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                    Step 1 — Initiate
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="modal-disp">
                                            Disposition (optional)
                                        </label>
                                        <input
                                            id="modal-disp"
                                            value={disposition}
                                            onChange={(e) => setDisposition(e.target.value)}
                                            disabled={busy || !!session?.dischargeInitiated || dischargeBlocked}
                                            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm dark:border-white/15 dark:bg-[#1a2332]"
                                            placeholder="e.g. home"
                                        />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="modal-sum">
                                            Discharge summary (optional)
                                        </label>
                                        <textarea
                                            id="modal-sum"
                                            value={dischargeSummary}
                                            onChange={(e) => setDischargeSummary(e.target.value)}
                                            disabled={busy || !!session?.dischargeInitiated || dischargeBlocked}
                                            rows={3}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-white/15 dark:bg-[#1a2332]"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : null}
            </div>
        </AppModal>
    );
}
