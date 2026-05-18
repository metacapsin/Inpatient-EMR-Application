import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { IRootState } from '../../../store';
import { useFacesheetChartLayout } from '../../../hooks/useFacesheetChartLayout';
import { useNursingFlowsheet } from '../../nursing-flowsheet/state/NursingFlowsheetContext';
import { useIoTracking } from '../hooks/useIoTracking';
import { resolveIoEncounterId } from '../utils/resolveIoEncounterId';
import { IoBalanceSummaryPanel } from './IoBalanceSummaryPanel';
import { IoTimelineTable } from './IoTimelineTable';

export interface IoTrackingTabProps {
    patientId: string;
    encounterId: string;
}

function resolveRecordedBy(user: IRootState['auth']['user']): { id: string; name: string } {
    if (!user) return { id: 'unknown', name: 'Unknown user' };
    const id = String(user.id ?? user._id ?? user.username ?? user.email ?? 'unknown');
    const name =
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        String(user.name ?? user.displayName ?? user.username ?? user.email ?? 'Clinical user');
    return { id, name };
}

export function IoTrackingTab({ patientId, encounterId }: IoTrackingTabProps) {
    const { moduleRootClass } = useFacesheetChartLayout();
    const authUser = useSelector((s: IRootState) => s.auth.user);
    const { state, isChartLocked } = useNursingFlowsheet();
    const tenantId = state.document.tenantId?.trim() || String(authUser?.tenant?.id ?? authUser?.tenantId ?? '');
    const shift = state.document.shiftType;
    const recorded = useMemo(() => resolveRecordedBy(authUser), [authUser]);

    const effectiveEncounterId = useMemo(
        () =>
            resolveIoEncounterId({
                adtEncounterId: encounterId,
                documentEncounterId: state.document.encounterId,
                patientId,
            }),
        [encounterId, state.document.encounterId, patientId]
    );

    const {
        summary,
        timeline,
        balanceLoading,
        balanceFetching,
        timelineLoading,
        timelineFetching,
        addRecord,
        adding,
        refreshSummary,
    } = useIoTracking(effectiveEncounterId);

    const disabled = isChartLocked || adding;
    const showEncounterHint = !encounterId.trim() && !effectiveEncounterId.trim();

    return (
        <div className={`${moduleRootClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2 py-1.5 lg:px-3">
                <div className="shrink-0">
                    <IoBalanceSummaryPanel
                        summary={summary}
                        loading={balanceLoading && !balanceFetching}
                        refreshing={balanceFetching}
                        onRefresh={() => void refreshSummary()}
                    />
                </div>

                {showEncounterHint ? (
                    <p className="shrink-0 rounded-lg border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                        Admit or select an active encounter to document I&amp;O.
                    </p>
                ) : null}

                {isChartLocked ? (
                    <p className="shrink-0 rounded-lg border border-gray-300/70 bg-gray-50/90 px-3 py-2 text-xs font-medium text-gray-800 dark:border-white/15 dark:bg-white/5 dark:text-gray-200">
                        This shift flowsheet is signed — I&amp;O entry is read-only until an amendment is opened.
                    </p>
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col">
                    <IoTimelineTable
                        rows={timeline}
                        loading={timelineLoading && !timelineFetching}
                        disabled={disabled}
                        patientId={patientId}
                        encounterId={effectiveEncounterId}
                        tenantId={tenantId}
                        recordedBy={recorded.id}
                        recordedByName={recorded.name}
                        shift={shift}
                        onAddRecord={addRecord}
                    />
                </div>
            </div>
        </div>
    );
}
