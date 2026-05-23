import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    buildUpdatePayload,
    createStaffingAssignment,
    fetchFloatPool,
    fetchStaffingAssignment,
    updateStaffingAssignment,
} from '../api/staffingWithFallback';
import type { StaffingShiftToken } from '../config/staffingMock.config';
import { buildStaffingAlerts, deriveKpis, moveBedBetweenNurses, recomputeBoard } from '../utils/staffingDerived';
import type { StaffingAssignmentBoard } from '../../../../types/staffing.types';

export interface LiveAssignmentsControls {
    unitId: string;
    date: string;
    shift: StaffingShiftToken;
    chargeNurseId: string;
}

interface UseLiveAssignmentsArgs {
    controls: LiveAssignmentsControls;
    tenantId: string;
    openShiftCount: number;
    enabled: boolean;
}

function parseDragIds(activeId: string, overId: string | undefined): { bedId: string; fromNurseId: string; toNurseId: string } | null {
    if (!overId) return null;
    const activeParts = activeId.split('::');
    const overParts = overId.split('::');
    if (activeParts[0] !== 'bed' || overParts[0] !== 'nurse') return null;
    return { bedId: activeParts[1], fromNurseId: activeParts[2], toNurseId: overParts[1] };
}

export function useLiveAssignments({ controls, tenantId, openShiftCount, enabled }: UseLiveAssignmentsArgs) {
    const [board, setBoard] = useState<StaffingAssignmentBoard | null>(null);
    const [floatPool, setFloatPool] = useState<Awaited<ReturnType<typeof fetchFloatPool>>>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const boardRef = useRef<StaffingAssignmentBoard | null>(null);

    boardRef.current = board;

    const loadBoard = useCallback(async () => {
        if (!enabled || !controls.unitId) {
            setBoard(null);
            return;
        }
        setLoading(true);
        try {
            let next = await fetchStaffingAssignment(controls.unitId, controls.date, controls.shift);
            if (!next) {
                next = await createStaffingAssignment({
                    unitId: controls.unitId,
                    date: controls.date,
                    shift: controls.shift,
                    chargeNurseId: controls.chargeNurseId || null,
                });
            }
            if (controls.chargeNurseId && next.chargeNurseId !== controls.chargeNurseId) {
                next = {
                    ...next,
                    chargeNurseId: controls.chargeNurseId,
                    nurses: next.nurses.map((n) => ({
                        ...n,
                        isChargeNurse: n.nurseId === controls.chargeNurseId,
                    })),
                };
            }
            setBoard(recomputeBoard(next));
        } catch {
            toast.error('Unable to load live assignments');
            setBoard(null);
        } finally {
            setLoading(false);
        }
    }, [controls.chargeNurseId, controls.date, controls.shift, controls.unitId, enabled]);

    useEffect(() => {
        void loadBoard();
    }, [loadBoard]);

    useEffect(() => {
        if (!enabled || !tenantId) return;
        void fetchFloatPool(tenantId).then(setFloatPool).catch(() => setFloatPool([]));
    }, [enabled, tenantId]);

    const kpis = useMemo(() => deriveKpis(board), [board]);
    const alerts = useMemo(
        () => buildStaffingAlerts({ board, openShiftCount, floatPool }),
        [board, floatPool, openShiftCount]
    );

    const persistBoard = useCallback(async (nextBoard: StaffingAssignmentBoard, rollback: StaffingAssignmentBoard) => {
        setSaving(true);
        try {
            const saved = await updateStaffingAssignment(
                nextBoard.assignmentId,
                buildUpdatePayload(nextBoard),
                nextBoard
            );
            setBoard(recomputeBoard(saved));
        } catch {
            setBoard(rollback);
            toast.error('Assignment update failed — changes reverted');
        } finally {
            setSaving(false);
        }
    }, []);

    const handleDragEnd = useCallback(
        (activeId: string, overId: string | undefined) => {
            const parsed = parseDragIds(activeId, overId);
            const current = boardRef.current;
            if (!parsed || !current) return;

            const next = moveBedBetweenNurses(current, parsed.bedId, parsed.fromNurseId, parsed.toNurseId);
            if (!next) return;

            const rollback = current;
            setBoard(next);
            void persistBoard(next, rollback);
        },
        [persistBoard]
    );

    const setChargeNurse = useCallback(
        (chargeNurseId: string) => {
            const current = boardRef.current;
            if (!current) return;
            const next = recomputeBoard({
                ...current,
                chargeNurseId,
                nurses: current.nurses.map((n) => ({ ...n, isChargeNurse: n.nurseId === chargeNurseId })),
            });
            const rollback = current;
            setBoard(next);
            void persistBoard(next, rollback);
        },
        [persistBoard]
    );

    return {
        board,
        floatPool,
        kpis,
        alerts,
        loading,
        saving,
        handleDragEnd,
        setChargeNurse,
        reload: loadBoard,
    };
}

export function dragIdForBed(bedId: string, nurseId: string): string {
    return `bed::${bedId}::${nurseId}`;
}

export function dropIdForNurse(nurseId: string): string {
    return `nurse::${nurseId}`;
}
