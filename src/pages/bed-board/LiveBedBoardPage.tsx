import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { BedDouble, RefreshCw } from 'lucide-react';
import { fetchLiveBedBoard } from '../../services/liveBedBoard.service';
import { listActiveEncounters } from '../../services/adt.service';
import { getRooms, getWards } from '../../services/rooms.service';
import { LiveBedBoardSummaryBar } from '../../modules/bed-board/LiveBedBoardSummaryBar';
import { LiveBedBoardFilters } from '../../modules/bed-board/LiveBedBoardFilters';
import { LiveBedBoardGrid } from '../../modules/bed-board/LiveBedBoardGrid';
import { ActiveEncountersPanel } from '../../modules/bed-board/ActiveEncountersPanel';

function useDocumentVisible(): boolean {
    const [visible, setVisible] = useState(
        () => typeof document !== 'undefined' && document.visibilityState === 'visible'
    );
    useEffect(() => {
        const fn = () => setVisible(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', fn);
        return () => document.removeEventListener('visibilitychange', fn);
    }, []);
    return visible;
}

const POLL_MS = 45_000;

const LiveBedBoardPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const docVisible = useDocumentVisible();

    const tab = searchParams.get('tab') === 'encounters' ? 'encounters' : 'board';
    const wardId = searchParams.get('wardId')?.trim() ?? '';
    const roomId = searchParams.get('roomId')?.trim() ?? '';
    const bedStatus = searchParams.get('bedStatus')?.trim() ?? '';
    const encPatientId = searchParams.get('patientId')?.trim() ?? '';
    const encBedId = searchParams.get('bedId')?.trim() ?? '';

    const setParam = useCallback(
        (updates: Record<string, string | null>) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    for (const [k, v] of Object.entries(updates)) {
                        if (v === null || v === '') next.delete(k);
                        else next.set(k, v);
                    }
                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const boardFilters = useMemo(
        () => ({
            wardId: wardId || undefined,
            roomId: roomId || undefined,
            bedStatus: bedStatus || undefined,
        }),
        [wardId, roomId, bedStatus]
    );

    const wardsQuery = useQuery({
        queryKey: ['settings', 'facility', 'wards'],
        queryFn: getWards,
        staleTime: 60_000,
    });

    const roomsQuery = useQuery({
        queryKey: ['settings', 'facility', 'rooms', wardId],
        queryFn: () => getRooms(wardId),
        enabled: Boolean(wardId),
        staleTime: 60_000,
    });

    const boardQuery = useQuery({
        queryKey: ['liveBedBoard', boardFilters],
        queryFn: () => fetchLiveBedBoard(boardFilters),
        staleTime: 15_000,
        refetchInterval: docVisible && tab === 'board' ? POLL_MS : false,
    });

    const encountersQuery = useQuery({
        queryKey: ['activeEncounters', { patientId: encPatientId || undefined, bedId: encBedId || undefined }],
        queryFn: () =>
            listActiveEncounters({
                patientId: encPatientId || undefined,
                bedId: encBedId || undefined,
            }),
        staleTime: 15_000,
        refetchInterval: docVisible && tab === 'encounters' ? POLL_MS : false,
    });

    useEffect(() => {
        if (!wardId || !roomId || !roomsQuery.data?.length) return;
        const ok = roomsQuery.data.some((r) => r.id === roomId);
        if (!ok) setParam({ roomId: null });
    }, [wardId, roomId, roomsQuery.data, setParam]);

    const lastBoardRefreshed = boardQuery.dataUpdatedAt
        ? format(boardQuery.dataUpdatedAt, 'MMM d, yyyy HH:mm:ss')
        : null;
    const lastEncRefreshed = encountersQuery.dataUpdatedAt
        ? format(encountersQuery.dataUpdatedAt, 'MMM d, yyyy HH:mm:ss')
        : null;

    const boardError =
        boardQuery.error instanceof Error ? boardQuery.error.message : boardQuery.error ? String(boardQuery.error) : null;
    const encError =
        encountersQuery.error instanceof Error
            ? encountersQuery.error.message
            : encountersQuery.error
              ? String(encountersQuery.error)
              : null;

    const encounterRows = useMemo(() => {
        const r = encountersQuery.data;
        if (!r || !r.ok) return [];
        return Array.isArray(r.data) ? r.data : [];
    }, [encountersQuery.data]);

    const encounterErrorMessage =
        encError ||
        (encountersQuery.data && !encountersQuery.data.ok ? encountersQuery.data.message : null);

    const onFilterEncountersByBed = (bedId: string) => {
        setParam({ tab: 'encounters', bedId, patientId: null });
    };

    return (
        <div className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/20">
                        <BedDouble className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Live bed board</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Operational view of beds, occupancy, and in-progress encounters. ADT actions use the{' '}
                            <Link to="/app/adt" className="font-medium text-primary underline-offset-2 hover:underline">
                                ADT workspace
                            </Link>{' '}
                            or chart ADT tab.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {tab === 'board' ? (
                        <button
                            type="button"
                            disabled={boardQuery.isFetching}
                            onClick={() => void boardQuery.refetch()}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            <RefreshCw className={`h-4 w-4 ${boardQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden />
                            Refresh board
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={encountersQuery.isFetching}
                            onClick={() => void encountersQuery.refetch()}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/5"
                        >
                            <RefreshCw className={`h-4 w-4 ${encountersQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden />
                            Refresh encounters
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1 dark:border-white/10">
                <button
                    type="button"
                    onClick={() => setParam({ tab: null })}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        tab === 'board'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                    }`}
                >
                    Board
                </button>
                <button
                    type="button"
                    onClick={() => setParam({ tab: 'encounters' })}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        tab === 'encounters'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                    }`}
                >
                    Active encounters
                </button>
            </div>
            </div>

            {tab === 'board' ? (
                <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden border-t border-white-light pt-4 dark:border-[#191e3a]">
                    <div className="shrink-0 space-y-4">
                    {boardQuery.data ? <LiveBedBoardSummaryBar summary={boardQuery.data.summary} /> : null}
                    <LiveBedBoardFilters
                        wardId={wardId}
                        roomId={roomId}
                        bedStatus={bedStatus}
                        wards={wardsQuery.data ?? []}
                        rooms={roomsQuery.data ?? []}
                        wardsLoading={wardsQuery.isLoading}
                        roomsLoading={roomsQuery.isFetching}
                        onWardChange={(w) => setParam({ wardId: w || null, roomId: null })}
                        onRoomChange={(r) => setParam({ roomId: r || null })}
                        onBedStatusChange={(s) => setParam({ bedStatus: s || null })}
                        disabled={boardQuery.isFetching}
                    />
                    {lastBoardRefreshed ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Last updated: {lastBoardRefreshed}</p>
                    ) : null}
                    {boardQuery.isError && boardError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100">
                            {boardError}
                        </div>
                    ) : null}
                    {!boardQuery.isError && !boardQuery.isLoading && boardQuery.data?.rows.length === 0 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            No beds returned. If this is unexpected, confirm wards and beds are configured under facility settings.
                        </p>
                    ) : null}
                    </div>
                    {!boardQuery.isError ? (
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <LiveBedBoardGrid
                            rows={boardQuery.data?.rows ?? []}
                            loading={boardQuery.isLoading}
                            onFilterEncountersByBed={onFilterEncountersByBed}
                        />
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden border-t border-white-light pt-4 dark:border-[#191e3a]">
                    <div className="shrink-0 space-y-4">
                    <div className="rounded-xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Optional filters match{' '}
                            <code className="rounded bg-gray-100 px-1 text-xs dark:bg-white/10">GET /api/admissions/active</code>{' '}
                            query params. Clear to list all in-progress admissions for your tenant.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-200" htmlFor="enc-patient">
                                    Patient id
                                </label>
                                <input
                                    id="enc-patient"
                                    value={encPatientId}
                                    onChange={(e) => setParam({ patientId: e.target.value.trim() || null })}
                                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm dark:border-white/12 dark:bg-[#1a1816]"
                                    placeholder="Mongo patient id"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-200" htmlFor="enc-bed">
                                    Bed id
                                </label>
                                <input
                                    id="enc-bed"
                                    value={encBedId}
                                    onChange={(e) => setParam({ bedId: e.target.value.trim() || null })}
                                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm dark:border-white/12 dark:bg-[#1a1816]"
                                    placeholder="Mongo bed id"
                                />
                            </div>
                        </div>
                    </div>
                    {lastEncRefreshed ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Last updated: {lastEncRefreshed}</p>
                    ) : null}
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <ActiveEncountersPanel
                        rows={encounterRows}
                        loading={encountersQuery.isLoading}
                        errorMessage={encounterErrorMessage}
                    />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveBedBoardPage;
