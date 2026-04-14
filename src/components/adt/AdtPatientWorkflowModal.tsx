import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { AppModal } from '../shared/AppModal';
import { formatAdtUserMessage } from '../../services/adt.service';
import { admitPatient, transferPatient } from '../../services/adtWorkflowService';
import { fetchEmrBedList } from '../../services/emrBeds.service';
import { bedOptionsForSelect } from '../../lib/adtBedPicker';
import type { AdmissionType } from '../../types/adt';
import type { AppDispatch, IRootState } from '../../store';
import { fetchFacesheetPatient } from '../../store/facesheetSlice';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import NewDropdown from '../ui/NewDropdown';

export type AdtWorkflowIntent = 'admit' | 'transfer';

const BED_BOARD_PATH = '/app/bed-board';

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
}

export function AdtPatientWorkflowModal({
    open,
    patientId,
    patientLabel,
    intent,
    onClose,
    onCompleted,
    facesheetPatientId,
}: AdtPatientWorkflowModalProps) {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const session = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));

    const [admitBedId, setAdmitBedId] = useState('');
    const [admissionType, setAdmissionType] = useState<AdmissionType | ''>('');

    const [transferBedId, setTransferBedId] = useState('');
    const [transferReason, setTransferReason] = useState('');

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
    }, [open, intent]);

    const ctx = useMemo(() => ({ dispatch, queryClient }), [dispatch, queryClient]);

    const refreshChart = () => {
        const pid = patientId.trim();
        if (facesheetPatientId?.trim() === pid) {
            void dispatch(fetchFacesheetPatient(pid));
        }
        onCompleted?.();
    };

    const goToBedBoard = () => {
        navigate(BED_BOARD_PATH);
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
            return admitPatient(ctx, body);
        },
        onSuccess: (result) => {
            const pid = patientId.trim();
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            if (!result.data.encounter?.id) {
                toast.error('Admission succeeded but no encounter id was returned.');
                return;
            }
            toast.success(result.message || 'Patient admitted');
            refreshChart();
            onClose();
            goToBedBoard();
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
            return transferPatient(ctx, {
                encounterId: session.encounterId,
                newBedId,
                ...(transferReason.trim() ? { reason: transferReason.trim() } : {}),
                patientId: patientId.trim(),
            });
        },
        onSuccess: (result) => {
            if (!result.ok) {
                toast.error(formatAdtUserMessage(result));
                return;
            }
            toast.success(result.message || 'Transfer completed');
            refreshChart();
            onClose();
            goToBedBoard();
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Transfer failed');
        },
    });

    const busy = admitMutation.isPending || transferMutation.isPending;

    const title = intent === 'admit' ? 'Admit patient' : 'Transfer patient';

    const bedsError = bedsQuery.error instanceof Error ? bedsQuery.error.message : null;

    const encounterReady = Boolean(session?.encounterId?.trim());
    const admitBlocked = encounterReady;
    const transferBlocked = !encounterReady || !!session?.dischargeInitiated;

    return (
        <AppModal
            open={open}
            onClose={() => !busy && onClose()}
            title={title}
            description={patientLabel}
            size="md"
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
                ) : (
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
                        This patient already has an active encounter in this workspace. Transfer or discharge before admitting again.
                    </p>
                ) : null}

                {intent === 'transfer' && transferBlocked ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        {session?.dischargeInitiated
                            ? 'Discharge is in progress — complete discharge readiness before transferring.'
                            : 'Admit the patient or link an encounter before transferring.'}
                    </p>
                ) : null}

                {transferSameBed ? (
                    <p className="text-sm text-red-700 dark:text-red-300">Select a bed different from the current assignment.</p>
                ) : null}

                {intent === 'admit' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label htmlFor="modal-adt-admit-bed" className="block text-sm font-medium text-gray-700 mb-1">
                                Bed (available)
                            </label>

                            <NewDropdown
                                id="modal-adt-admit-bed"
                                value={admitBedId || ''}
                                placeholder={
                                    bedsQuery.isLoading
                                        ? 'Loading beds…'
                                        : admitOptions.length
                                          ? 'Select bed'
                                          : 'No available beds'
                                }
                                options={admitOptions.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                                onChange={(v) => setAdmitBedId(String(v))}
                                disabled={busy || bedsQuery.isLoading || admitBlocked}
                            />
                        </div>
                        <NewDropdown
                            id="modal-adt-admission-type"
                            label="Admission type (optional)"
                            value={admissionType}
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
                            <NewDropdown
                                id="modal-adt-transfer-bed"
                                label="New bed (available)"
                                value={transferBedId}
                                placeholder={
                                    bedsQuery.isLoading
                                        ? 'Loading beds…'
                                        : transferOptions.length
                                          ? 'Select bed'
                                          : 'No available beds'
                                }
                                options={transferOptions.map((o) => ({ value: o.value, label: o.label }))}
                                onChange={(v) => setTransferBedId(String(v))}
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
            </div>
        </AppModal>
    );
}
