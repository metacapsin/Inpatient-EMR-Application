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
import {
    blockingReasonsFromReadiness,
    fetchDischargeFinalizeReadiness,
} from '../services/dischargeFinalizeReadiness.service';
import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import {
    confirmDischarge,
    formatAdtUserMessage,
    initiateDischarge,
} from '../services/adtWorkflowService';

function allGatesTrue(r: DischargeFinalizeReadiness): boolean {
    return (
        r.dischargeSummaryCompleted &&
        r.medicationCompleted &&
        r.billingCleared &&
        r.insuranceVerified
    );
}

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
    view: DischargeReadinessView
): DischargeFinalizeFlowState {
    const eid = encounterId.trim();
    const patientId = view.context.patientId?.trim() ?? '';
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const ctx = { dispatch, queryClient };
    const adt = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));

    const readinessQuery = useQuery({
        queryKey: [
            'dischargeFinalizeReadiness',
            eid,
            view.summary.status,
            view.billingReady,
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
            const gateData = fin.data;
            if (!allGatesTrue(gateData)) {
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
    const blockingReasons = gatesForUi ? blockingReasonsFromReadiness(gatesForUi) : [];
    const canFinalize = Boolean(
        gatesForUi && allGatesTrue(gatesForUi) && !finalizeMutation.isPending && !readinessQuery.isLoading
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
