import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRightLeft } from 'lucide-react';
import type { LiveBedBoardRow } from '../../types/liveBedBoard';
import { PriorityChip } from '../../components/adt/TransferRequestForm';
import { invalidateAdtSurfaces } from '../../lib/adtInvalidate';
import {
    cancelTransferRequest,
    fulfillTransferRequest,
    listTransferRequests,
    type TransferRequest,
} from '../../services/bedManagement.service';

interface TransferRequestsPanelProps {
    /** Live bed board rows (unfiltered by status) — used to offer destination beds. */
    rows: LiveBedBoardRow[];
    loading: boolean;
}

function fmt(ts: string | null | undefined): string {
    if (!ts) return '—';
    try {
        return format(parseISO(ts), 'MMM d, HH:mm');
    } catch {
        return ts;
    }
}

function FulfilControls({ req, rows, busy, onFulfil }: { req: TransferRequest; rows: LiveBedBoardRow[]; busy: boolean; onFulfil: (bedId: string) => void }) {
    const [bedId, setBedId] = useState('');
    const [anyWard, setAnyWard] = useState(!req.requestedWardId);
    const options = useMemo(
        () =>
            rows
                .filter((r) => r.bed.bedStatus === 'available' && !r.encounter && (anyWard || !req.requestedWardId || r.ward?.id === req.requestedWardId))
                .map((r) => ({ value: r.bed.id, label: [r.ward?.name, r.room?.name, r.bed.label].filter(Boolean).join(' · ') })),
        [rows, anyWard, req.requestedWardId]
    );
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <select
                value={bedId}
                onChange={(e) => setBedId(e.target.value)}
                disabled={busy}
                aria-label={`Destination bed for ${req.patientName}`}
                className="h-7 max-w-[14rem] rounded-md border border-gray-200/80 bg-white px-2 text-xs dark:border-white/[0.08] dark:bg-[#1a1816]"
            >
                <option value="">{options.length ? 'Destination bed…' : 'No available beds'}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {req.requestedWardId ? (
                <label className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <input type="checkbox" checked={anyWard} onChange={(e) => setAnyWard(e.target.checked)} className="h-3 w-3" />
                    any ward
                </label>
            ) : null}
            <button
                type="button"
                disabled={busy || !bedId}
                onClick={() => onFulfil(bedId)}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-600 disabled:pointer-events-none disabled:opacity-50"
            >
                <ArrowRightLeft className="h-3 w-3" aria-hidden /> Transfer
            </button>
        </div>
    );
}

/** Open bed requests ranked by priority; fulfilling one performs the ADT transfer. */
export function TransferRequestsPanel({ rows, loading }: TransferRequestsPanelProps) {
    const queryClient = useQueryClient();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const q = useQuery({
        queryKey: ['transfer-requests', 'open'],
        queryFn: () => listTransferRequests({ status: 'open' }),
        staleTime: 5_000,
        refetchInterval: 30_000,
    });
    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
        invalidateAdtSurfaces(queryClient);
        void queryClient.invalidateQueries({ queryKey: ['evs'] });
    };
    const fulfilMut = useMutation({
        mutationFn: ({ id, bedId }: { id: string; bedId: string }) => fulfillTransferRequest(id, bedId),
        onSuccess: (r) => {
            toast.success(`${r.request.patientName} transferred to ${r.request.fulfilledBedLabel ?? 'new bed'}`);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
        onSettled: () => setPendingId(null),
    });
    const cancelMut = useMutation({
        mutationFn: (id: string) => cancelTransferRequest(id),
        onSuccess: () => {
            toast.success('Request cancelled');
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
        onSettled: () => setPendingId(null),
    });

    const items = q.data ?? [];
    if (q.isLoading || loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                ))}
            </div>
        );
    }
    if (q.isError) {
        return <p className="text-xs text-red-700 dark:text-red-300">{q.error instanceof Error ? q.error.message : 'Failed to load transfer requests'}</p>;
    }
    if (!items.length) {
        return (
            <div className="rounded-xl border border-dashed border-gray-200/80 bg-gray-50/50 px-6 py-12 text-center text-xs text-gray-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-gray-400">
                No open transfer requests. Clinicians raise them from a patient&apos;s ADT workspace.
            </div>
        );
    }
    return (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200/70 dark:border-white/[0.08]">
            <table className="w-full min-w-[840px] text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-gray-200/80 bg-gray-50/90 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:border-white/[0.06] dark:bg-[#1c1c1c]/95 dark:text-gray-400">
                    <tr>
                        <th className="px-2.5 py-2">Priority</th>
                        <th className="px-2.5 py-2">Patient</th>
                        <th className="px-2.5 py-2">Current</th>
                        <th className="px-2.5 py-2">Requested</th>
                        <th className="px-2.5 py-2">Reason</th>
                        <th className="px-2.5 py-2">Requested by</th>
                        <th className="px-2.5 py-2 text-right">Fulfil</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/90 dark:divide-white/[0.05]">
                    {items.map((r) => {
                        const busy = pendingId === r.id;
                        return (
                            <tr key={r.id} className="align-middle hover:bg-gray-50/90 dark:hover:bg-white/[0.04]">
                                <td className="px-2.5 py-2">
                                    <PriorityChip priority={r.priority} />
                                </td>
                                <td className="px-2.5 py-2">
                                    <Link to={`/app/facesheet/${encodeURIComponent(r.patientId)}/adt`} className="font-medium text-gray-900 hover:underline dark:text-white">
                                        {r.patientName}
                                    </Link>
                                    <div className="font-mono text-[10px] text-gray-500">{r.mrn}</div>
                                </td>
                                <td className="px-2.5 py-2 text-gray-700 dark:text-gray-300">{r.currentLocation ?? '—'}</td>
                                <td className="px-2.5 py-2 font-medium text-gray-900 dark:text-gray-100">{r.requestedWardName ?? 'Any ward'}</td>
                                <td className="max-w-[200px] truncate px-2.5 py-2 text-gray-700 dark:text-gray-300" title={r.reason ?? ''}>
                                    {r.reason ?? '—'}
                                </td>
                                <td className="px-2.5 py-2 text-gray-600 dark:text-gray-400">
                                    {r.requestedByName ?? '—'}
                                    <div className="text-[10px] text-gray-500">{fmt(r.requestedAt)}</div>
                                </td>
                                <td className="px-2.5 py-2">
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                        <FulfilControls
                                            req={r}
                                            rows={rows}
                                            busy={busy}
                                            onFulfil={(bedId) => {
                                                setPendingId(r.id);
                                                fulfilMut.mutate({ id: r.id, bedId });
                                            }}
                                        />
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                setPendingId(r.id);
                                                cancelMut.mutate(r.id);
                                            }}
                                            className="inline-flex h-7 items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
