import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { BedDouble, RefreshCw } from 'lucide-react';
import { fetchLiveBedBoard } from '../../services/liveBedBoard.service';
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

const tabBtnBase =
    'inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition';
const tabBtnInactive =
    'border border-transparent text-gray-600 hover:bg-gray-100/80 dark:text-gray-400 dark:hover:bg-white/[0.04]';
const tabBtnActive = 'bg-primary text-white shadow-sm';

const LiveBedBoardPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const docVisible = useDocumentVisible();

    const tab = searchParams.get('tab') === 'encounters' ? 'encounters' : 'board';
    const wardId = searchParams.get('wardId')?.trim() ?? '';
    const roomId = searchParams.get('roomId')?.trim() ?? '';
    const bedStatus = searchParams.get('bedStatus')?.trim() ?? '';
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
        /** Single source for board + active encounters tab; keep both views in sync. */
        refetchInterval: docVisible ? POLL_MS : false,
    });

    useEffect(() => {
        if (!wardId || !roomId || !roomsQuery.data?.length) return;
        const ok = roomsQuery.data.some((r) => r.id === roomId);
        if (!ok) setParam({ roomId: null });
    }, [wardId, roomId, roomsQuery.data, setParam]);

    const lastBoardRefreshed = boardQuery.dataUpdatedAt
        ? format(boardQuery.dataUpdatedAt, 'MMM d, yyyy HH:mm:ss')
        : null;
    const boardError =
        boardQuery.error instanceof Error ? boardQuery.error.message : boardQuery.error ? String(boardQuery.error) : null;

    const activeBedBoardRows = useMemo(
        () => (boardQuery.data?.rows ?? []).filter((r) => r.encounter !== null),
        [boardQuery.data?.rows]
    );

    return (
        <div className="font-inter relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-[#141210] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.45)]">
            <div className="shrink-0 space-y-3 p-4 sm:p-5 sm:pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                            <BedDouble className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">Live bed board</h1>
                            <p className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-500">
                                Beds and encounters. ADT:{' '}
                                <Link to="/app/adt" className="font-medium text-primary underline-offset-2 hover:underline">
                                    ADT workspace
                                </Link>{' '}
                                or chart ADT.
                            </p>
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                        <button
                            type="button"
                            disabled={boardQuery.isFetching}
                            onClick={() => void boardQuery.refetch()}
                            className="inline-flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200/80 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50/80 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04] sm:w-auto"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${boardQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden />
                            {tab === 'encounters' ? 'Refresh encounters' : 'Refresh board'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5 border-b border-gray-200/50 pb-0.5 dark:border-white/[0.06]">
                    <button
                        type="button"
                        onClick={() => setParam({ tab: null })}
                        className={`${tabBtnBase} ${tab === 'board' ? tabBtnActive : tabBtnInactive}`}
                    >
                        Board
                    </button>
                    <button
                        type="button"
                        onClick={() => setParam({ tab: 'encounters' })}
                        className={`${tabBtnBase} ${tab === 'encounters' ? tabBtnActive : tabBtnInactive}`}
                    >
                        Active encounters
                    </button>
                </div>

                {tab === 'board' ? (
                    <div className="space-y-3 border-t border-gray-200/50 pt-3 dark:border-white/[0.06]">
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
                            <p className="text-[11px] text-gray-500 dark:text-gray-500">Last updated: {lastBoardRefreshed}</p>
                        ) : null}
                        {boardQuery.isError && boardError ? (
                            <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/35 dark:bg-amber-950/30 dark:text-amber-100">
                                {boardError}
                            </div>
                        ) : null}
                        {!boardQuery.isError && !boardQuery.isLoading && boardQuery.data?.rows.length === 0 ? (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                No beds returned. If this is unexpected, confirm wards and beds are configured under facility settings.
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <div className="border-t border-gray-200/50 pt-3 dark:border-white/[0.06]">
                        <p className="text-xs leading-snug text-gray-500 dark:text-gray-500">
                            Same dataset as Board — adjust ward, room, and bed status on the Board tab.
                            {lastBoardRefreshed ? (
                                <span className="text-gray-400 dark:text-gray-600"> · Last updated: {lastBoardRefreshed}</span>
                            ) : null}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden border-t border-gray-200/50 px-4 pb-4 pt-3 dark:border-white/[0.06] sm:px-5 sm:pb-5 sm:pt-3">
                {tab === 'board' ? (
                    !boardQuery.isError ? (
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <LiveBedBoardGrid rows={boardQuery.data?.rows ?? []} loading={boardQuery.isLoading} />
                        </div>
                    ) : null
                ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <ActiveEncountersPanel
                            rows={activeBedBoardRows}
                            loading={boardQuery.isLoading}
                            errorMessage={boardQuery.isError ? boardError : null}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveBedBoardPage;
