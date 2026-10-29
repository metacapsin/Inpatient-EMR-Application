import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { LabeledDropdown } from '../shared/LabeledDropdown';
import { PlacementWarningsBanner } from './PlacementWarningsBanner';
import { invalidateAdtSurfaces } from '../../lib/adtInvalidate';
import type { EmrBedListItem } from '../../services/emrBeds.service';
import {
    HOLD_DURATION_OPTIONS,
    cancelReservation,
    extendReservation,
    listReservations,
    reserveBed,
} from '../../services/bedManagement.service';

interface BedHoldPanelProps {
    patientId: string;
    encounterId?: string;
    /** Beds eligible for a hold (available ones from the ADT bed list). */
    beds: EmrBedListItem[];
    disabled?: boolean;
}

function expiresIn(iso: string): string {
    try {
        const d = parseISO(iso);
        return d.getTime() <= Date.now() ? 'expired' : `in ${formatDistanceToNowStrict(d)}`;
    } catch {
        return iso;
    }
}

/**
 * Timed bed hold ("reserve a bed for this patient"). The held bed shows as `hold` on the bed board,
 * nobody else can be admitted into it, and it auto-releases when the timer runs out.
 */
export function BedHoldPanel({ patientId, encounterId, beds, disabled }: BedHoldPanelProps) {
    const queryClient = useQueryClient();
    const [bedId, setBedId] = useState('');
    const [minutes, setMinutes] = useState('120');
    const [notes, setNotes] = useState('');

    const holdsQuery = useQuery({
        queryKey: ['bed-reservations', 'patient', patientId],
        queryFn: () => listReservations({ status: 'active', patientId }),
        enabled: Boolean(patientId),
        staleTime: 5_000,
        refetchInterval: 60_000,
    });
    const holds = holdsQuery.data ?? [];

    const options = useMemo(
        () => beds.filter((b) => b.bedStatus === '' || b.bedStatus === 'available').map((b) => ({ value: b.id, label: b.label })),
        [beds]
    );

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['bed-reservations'] });
        invalidateAdtSurfaces(queryClient);
    };

    const reserveMut = useMutation({
        mutationFn: () => reserveBed(bedId, { patientId, ...(encounterId ? { encounterId } : {}), expiresInMinutes: Number(minutes), ...(notes.trim() ? { notes: notes.trim() } : {}) }),
        onSuccess: (r) => {
            toast.success(`${r.displayLabel} held ${expiresIn(r.expiresAt)}`);
            setBedId('');
            setNotes('');
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const cancelMut = useMutation({
        mutationFn: (id: string) => cancelReservation(id),
        onSuccess: () => {
            toast.success('Hold released');
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const extendMut = useMutation({
        mutationFn: (id: string) => extendReservation(id, 60),
        onSuccess: (r) => {
            toast.success(`Hold extended — expires ${expiresIn(r.expiresAt)}`);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const busy = disabled || reserveMut.isPending || cancelMut.isPending || extendMut.isPending;

    return (
        <div className="space-y-3">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Hold a bed</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Reserve a bed for this patient ahead of {encounterId ? 'a transfer' : 'admission'}. The hold blocks other
                    placements and releases itself when the timer runs out.
                </p>
            </div>

            {holds.length ? (
                <ul className="space-y-2">
                    {holds.map((h) => (
                        <li
                            key={h.id}
                            className="flex flex-col gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <span className="font-semibold">{h.displayLabel}</span>
                                <span className="ml-2 inline-flex items-center gap-1 opacity-80">
                                    <Clock3 className="h-3 w-3" aria-hidden /> expires {expiresIn(h.expiresAt)}
                                </span>
                                {h.notes ? <span className="ml-2 opacity-80">· {h.notes}</span> : null}
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => extendMut.mutate(h.id)}
                                    className="rounded-md border border-amber-300/80 bg-white px-2 py-1 font-semibold text-amber-900 disabled:opacity-50 dark:border-amber-800/60 dark:bg-transparent dark:text-amber-100"
                                >
                                    +1 hour
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => cancelMut.mutate(h.id)}
                                    className="rounded-md border border-amber-300/80 bg-white px-2 py-1 font-semibold text-amber-900 disabled:opacity-50 dark:border-amber-800/60 dark:bg-transparent dark:text-amber-100"
                                >
                                    Release
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                    <LabeledDropdown
                        id="adt-hold-bed"
                        label="Bed to hold"
                        value={bedId || undefined}
                        placeholder={options.length ? 'Select available bed' : 'No available beds'}
                        options={options}
                        onChange={setBedId}
                        disabled={busy || !options.length}
                        compact
                    />
                </div>
                <LabeledDropdown
                    id="adt-hold-minutes"
                    label="Hold for"
                    value={minutes}
                    placeholder="Duration"
                    options={HOLD_DURATION_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
                    onChange={setMinutes}
                    disabled={busy}
                    compact
                />
                <div className="space-y-1 sm:col-span-3">
                    <label className="text-xs text-gray-600 dark:text-gray-400" htmlFor="adt-hold-notes">
                        Note (optional)
                    </label>
                    <input
                        id="adt-hold-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={busy}
                        placeholder="e.g. ED boarder, expected 14:30"
                        className="h-8 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-white/12 dark:bg-[#1a1816]"
                    />
                </div>
                {bedId ? (
                    <div className="sm:col-span-3">
                        <PlacementWarningsBanner bedId={bedId} patientId={patientId} encounterId={encounterId} />
                    </div>
                ) : null}
            </div>
            <button
                type="button"
                disabled={busy || !bedId}
                onClick={() => reserveMut.mutate()}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50 dark:border-amber-900/45 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
            >
                {reserveMut.isPending ? 'Holding…' : 'Hold bed'}
            </button>
        </div>
    );
}
