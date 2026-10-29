import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LabeledDropdown } from '../shared/LabeledDropdown';
import { getWards } from '../../services/rooms.service';
import {
    TRANSFER_PRIORITIES,
    cancelTransferRequest,
    createTransferRequest,
    listTransferRequests,
    type TransferPriority,
} from '../../services/bedManagement.service';

const PRIORITY_CHIP: Record<TransferPriority, string> = {
    urgent: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
    medium: 'bg-amber-100 text-amber-900 dark:bg-amber-950/45 dark:text-amber-200',
    low: 'bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-gray-300',
};

export function PriorityChip({ priority }: { priority: TransferPriority }) {
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_CHIP[priority] ?? PRIORITY_CHIP.low}`}>
            {priority}
        </span>
    );
}

/**
 * Ask bed management for a bed elsewhere (e.g. step-down to Tele, up to ICU). Priority is a manual
 * field — not an acuity score. Open requests appear on the bed board's "Transfer requests" tab and
 * the IPD dashboard; fulfilling one performs the transfer.
 */
export function TransferRequestForm({ patientId, encounterId, disabled }: { patientId: string; encounterId: string; disabled?: boolean }) {
    const queryClient = useQueryClient();
    const [wardId, setWardId] = useState('');
    const [priority, setPriority] = useState<TransferPriority>('medium');
    const [reason, setReason] = useState('');

    const wardsQuery = useQuery({ queryKey: ['settings', 'facility', 'wards'], queryFn: getWards, staleTime: 60_000 });
    const openQuery = useQuery({
        queryKey: ['transfer-requests', 'open'],
        queryFn: () => listTransferRequests({ status: 'open' }),
        staleTime: 5_000,
    });
    const mine = useMemo(() => (openQuery.data ?? []).find((r) => r.encounterId === encounterId) ?? null, [openQuery.data, encounterId]);

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
        void queryClient.invalidateQueries({ queryKey: ['ipdDashboard'] });
    };
    const createMut = useMutation({
        mutationFn: () => createTransferRequest({ patientId, encounterId, ...(wardId ? { requestedWardId: wardId } : {}), priority, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
        onSuccess: () => {
            toast.success('Transfer request sent to bed management');
            setReason('');
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const cancelMut = useMutation({
        mutationFn: (id: string) => cancelTransferRequest(id),
        onSuccess: () => {
            toast.success('Transfer request withdrawn');
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const busy = disabled || createMut.isPending || cancelMut.isPending;

    return (
        <div className="space-y-3">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Request a transfer</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Queue a bed request for another unit. Bed management fulfils it from the bed board&apos;s Transfer requests tab.
                </p>
            </div>
            {mine ? (
                <div className="flex flex-col gap-2 rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2 text-xs text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-x-2">
                        <PriorityChip priority={mine.priority} />
                        <span className="font-semibold">→ {mine.requestedWardName ?? 'Any ward'}</span>
                        {mine.reason ? <span className="opacity-80">· {mine.reason}</span> : null}
                        <span className="opacity-70">· requested by {mine.requestedByName ?? 'staff'}</span>
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => cancelMut.mutate(mine.id)}
                        className="shrink-0 rounded-md border border-sky-300/80 bg-white px-2 py-1 font-semibold text-sky-900 disabled:opacity-50 dark:border-sky-800/60 dark:bg-transparent dark:text-sky-100"
                    >
                        Withdraw
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <LabeledDropdown
                            id="adt-tr-ward"
                            label="Requested ward"
                            value={wardId || undefined}
                            placeholder={wardsQuery.isLoading ? 'Loading…' : 'Any ward'}
                            options={(wardsQuery.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
                            onChange={setWardId}
                            disabled={busy}
                            compact
                        />
                        <LabeledDropdown
                            id="adt-tr-priority"
                            label="Priority"
                            value={priority}
                            placeholder="Priority"
                            options={TRANSFER_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
                            onChange={(v) => setPriority(v as TransferPriority)}
                            disabled={busy}
                            compact
                        />
                        <div className="space-y-1">
                            <label className="text-xs text-gray-600 dark:text-gray-400" htmlFor="adt-tr-reason">
                                Reason (optional)
                            </label>
                            <input
                                id="adt-tr-reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={busy}
                                placeholder="e.g. needs telemetry"
                                className="h-8 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-white/12 dark:bg-[#1a1816]"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => createMut.mutate()}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-50 dark:border-sky-900/45 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60"
                    >
                        {createMut.isPending ? 'Sending…' : 'Request transfer'}
                    </button>
                </>
            )}
        </div>
    );
}
