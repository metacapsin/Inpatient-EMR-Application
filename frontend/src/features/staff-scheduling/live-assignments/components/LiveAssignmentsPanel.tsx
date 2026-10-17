import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FacilityWard } from '../../../../types/facility';
import type { StaffingShiftToken } from '../config/staffingMock.config';
import { useLiveAssignments, type LiveAssignmentsControls } from '../hooks/useLiveAssignments';
import { StaffingKpiBar } from './StaffingKpiBar';
import { CriticalAlertStrip } from './CriticalAlertStrip';
import { LiveAssignmentsHeaderControls, type LiveAssignmentsHeaderValue } from './LiveAssignmentsHeaderControls';
import { NurseAssignmentBoard } from './NurseAssignmentBoard';
import { FloatPoolPanel } from './FloatPoolPanel';

interface LiveAssignmentsPanelProps {
    wards: FacilityWard[];
    tenantId: string;
    openShiftCount: number;
    canManage: boolean;
    defaultWardId?: string;
}

export function LiveAssignmentsPanel({
    wards,
    tenantId,
    openShiftCount,
    canManage,
    defaultWardId,
}: LiveAssignmentsPanelProps) {
    const navigate = useNavigate();
    const today = new Date().toISOString().slice(0, 10);
    const [header, setHeader] = useState<LiveAssignmentsHeaderValue>(() => ({
        unitId: defaultWardId ?? (wards[0] ? String(wards[0].id) : ''),
        date: today,
        shift: 'day',
        chargeNurseId: '',
    }));

    const controls: LiveAssignmentsControls = useMemo(
        () => ({
            unitId: header.unitId,
            date: header.date,
            shift: header.shift,
            chargeNurseId: header.chargeNurseId,
        }),
        [header]
    );

    const { board, floatPool, kpis, alerts, loading, saving, handleDragEnd, setChargeNurse } = useLiveAssignments({
        controls,
        tenantId,
        openShiftCount,
        enabled: Boolean(header.unitId),
    });

    useEffect(() => {
        if (board?.chargeNurseId && board.chargeNurseId !== header.chargeNurseId) {
            setHeader((h) => ({ ...h, chargeNurseId: board.chargeNurseId ?? '' }));
        }
    }, [board?.chargeNurseId, header.chargeNurseId]);

    const patchHeader = useCallback(
        (patch: Partial<LiveAssignmentsHeaderValue>) => {
            setHeader((h) => ({ ...h, ...patch }));
            if (patch.chargeNurseId !== undefined) {
                setChargeNurse(patch.chargeNurseId);
            }
        },
        [setChargeNurse]
    );

    const onAlertAction = useCallback(
        (alertId: string) => {
            if (alertId === 'open-shifts') {
                navigate('/app/staff-scheduling?tab=open-shifts');
            }
        },
        [navigate]
    );

    const nurses = board?.nurses ?? [];

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <StaffingKpiBar kpis={kpis} loading={loading} />
            <CriticalAlertStrip alerts={alerts} onAction={onAlertAction} />

            <LiveAssignmentsHeaderControls
                value={header}
                wards={wards}
                nurses={nurses}
                totalPatients={board?.totalPatients ?? 0}
                onChange={patchHeader}
            />

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
                <div className="min-h-0 flex-1 overflow-auto">
                    {!header.unitId ? (
                        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700">
                            Select a unit to load live nurse assignments.
                        </p>
                    ) : loading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading live assignments…</p>
                    ) : board ? (
                        <>
                            {saving ? (
                                <p className="mb-2 text-[11px] font-medium text-primary">Saving assignment changes…</p>
                            ) : null}
                            <NurseAssignmentBoard
                                nurses={board.nurses}
                                saving={saving || !canManage}
                                onDragEnd={canManage ? handleDragEnd : () => undefined}
                            />
                        </>
                    ) : (
                        <p className="text-sm text-gray-500">No assignment board for this shift.</p>
                    )}
                </div>
                <div className="w-full shrink-0 lg:w-56">
                    <FloatPoolPanel nurses={floatPool} canManage={canManage} />
                </div>
            </div>
        </div>
    );
}
