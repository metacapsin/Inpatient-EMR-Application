import { useMemo } from 'react';
import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppDispatch, IRootState } from '../store';
import { selectAdtEncounter } from '../store/adtEncounterSlice';
import type { DischargeReadinessView } from '../types/dischargeReadiness';
import { fetchDischargeFinalizeReadiness } from '../services/dischargeFinalizeReadiness.service';
import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import {
    confirmDischarge,
    formatAdtUserMessage,
    initiateDischarge,
} from '../services/adtWorkflowService';
import { useDischargeReadinessOptional } from '../contexts/DischargeReadinessContext';
import { computeReadinessSnapshot, getDischargeWorkspaceBlockingMessages } from '../utils/dischargeReadinessValidation';
import { getDischargeBlockingFriendlyMessages } from '../utils/dischargeReadinessUi';

type FetchDischargeFinalizeReadinessOk = {
    ok: true;
    data: DischargeFinalizeReadiness;
    source: 'api' | 'derived';
};

export type DischargeFinalizeFlowState = {
    encounterId: string;
    patientId: string;
    readinessQuery: UseQueryResult<FetchDischargeFinalizeReadinessOk, Error>;
    finalizeMutation: UseMutationResult<void, unknown, void, unknown>;
    gatesForUi: DischargeFinalizeReadiness | null;
    blockingReasons: string[];
    canFinalize: boolean;
    derivedFromClinical: boolean;
    finalizeDischarge: () => void;
};

export function useDischargeFinalizeFlow(
    encounterId: string,
    view: DischargeReadinessView,
): DischargeFinalizeFlowState {
    const eid = encounterId.trim();
    const patientId = view.context.patientId?.trim() ?? '';
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const ctx = { dispatch, queryClient };
    const adt = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));

    const dischargeCtx = useDischargeReadinessOptional();
    const snapshot = useMemo(
        () => dischargeCtx?.snapshot ?? computeReadinessSnapshot(view),
        [dischargeCtx?.snapshot, view],
    );
    const readinessQuery = useQuery({
        queryKey: [
            'dischargeFinalizeReadiness',
            eid,
            view.summary.status,
            view.checklist.map((t) => `${t.id}:${t.completed}`).join('|'),
            view.eligibilityHistory.map((x) => `${x.id}:${x.status}`).join('|'),
        ],
        queryFn: async (): Promise<FetchDischargeFinalizeReadinessOk> => {
            const r = await fetchDischargeFinalizeReadiness(eid, view);
            if (!r.ok) throw new Error(r.message);
            return r;
        },
        enabled: Boolean(eid),
    });

    const finalizeMutation = useMutation({
        mutationFn: async () => {
            const fin = readinessQuery.data;
            if (!fin?.ok) throw new Error('Discharge readiness is not available.');
            const snap = dischargeCtx?.snapshot ?? computeReadinessSnapshot(view);
            const blockers = getDischargeWorkspaceBlockingMessages(snap);
            if (blockers.length > 0) {
                throw new Error('Discharge readiness gates are not satisfied.');
            }
            if (!adt?.dischargeInitiated) {
                const init = await initiateDischarge(ctx, {
                    encounterId: eid,
                    patientId: patientId || undefined,
                });
                if (!init.ok) throw new Error(formatAdtUserMessage(init));
            }
            const conf = await confirmDischarge(ctx, {
                encounterId: eid,
                patientId: patientId || undefined,
            });
            if (!conf.ok) throw new Error(formatAdtUserMessage(conf));
        },
        onSuccess: () => {
            toast.success('Patient successfully discharged');
            const returnTo = searchParams.get('returnTo');
            navigate(returnTo === 'bed-board' ? '/app/bed-board' : '/app/patients/list');
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : 'Finalize discharge failed');
        },
    });

    const finReady = readinessQuery.data?.ok === true ? readinessQuery.data : null;
    const gatesForUi = finReady?.data ?? null;

    const blockingReasons = useMemo(
        () => getDischargeBlockingFriendlyMessages(view, snapshot),
        [view, snapshot],
    );

    const canFinalize = Boolean(
        getDischargeWorkspaceBlockingMessages(snapshot).length === 0 &&
            !finalizeMutation.isPending &&
            !readinessQuery.isLoading,
    );

    return {
        encounterId: eid,
        patientId,
        readinessQuery,
        finalizeMutation,
        gatesForUi,
        blockingReasons,
        canFinalize,
        derivedFromClinical: finReady?.source === 'derived',
        finalizeDischarge: () => finalizeMutation.mutate(),
    };
}
