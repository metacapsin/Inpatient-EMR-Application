import { useMemo } from 'react';
import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppDispatch } from '../store';
import type { DischargeReadinessView, ReadinessGate } from '../types/dischargeReadiness';
import { fetchDischargeFinalizeReadiness } from '../services/dischargeFinalizeReadiness.service';
import type { DischargeFinalizeReadiness } from '../types/dischargeFinalizeReadiness';
import { confirmDischarge, formatAdtUserMessage, initiateDischarge } from '../services/adtWorkflowService';
import { dischargeBlockingGates } from '../services/adt.service';
import { serverGateBlockingMessages } from '../utils/dischargeReadinessValidation';

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
    /** Unresolved server gates (hard first). */
    blockingReasons: string[];
    canFinalize: boolean;
    derivedFromClinical: boolean;
    finalizeDischarge: () => void;
};

/**
 * Finalize flow driven entirely by the server: `GET /api/discharges/readiness/:id` supplies the gate list,
 * `POST /api/discharges` initiate (when the encounter is still `admitted`) and `POST /api/discharges/confirm`
 * enforce them. No client-side gate can block or unblock a discharge.
 */
export function useDischargeFinalizeFlow(encounterId: string, view: DischargeReadinessView): DischargeFinalizeFlowState {
    const eid = encounterId.trim();
    const patientId = view.context.patientId?.trim() ?? '';
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const ctx = { dispatch, queryClient };

    const readinessQuery = useQuery({
        queryKey: [
            'dischargeFinalizeReadiness',
            eid,
            view.summary.status,
            view.checklist.map((t) => `${t.id}:${t.completed}`).join('|'),
            view.medRecComplete ?? '',
        ],
        queryFn: async (): Promise<FetchDischargeFinalizeReadinessOk> => {
            const r = await fetchDischargeFinalizeReadiness(eid, view);
            if (!r.ok) throw new Error(r.message);
            return r;
        },
        enabled: Boolean(eid),
    });

    const finReady = readinessQuery.data?.ok === true ? readinessQuery.data : null;
    const gatesForUi = finReady?.data ?? null;

    // Prefer the finalize endpoint's gates (freshest); fall back to the readiness view's gates.
    const serverGates: ReadinessGate[] = useMemo(() => {
        const fromApi = gatesForUi?.gates;
        if (Array.isArray(fromApi) && fromApi.length) return fromApi;
        return view.gates;
    }, [gatesForUi?.gates, view.gates]);

    const blockingReasons = useMemo(() => serverGateBlockingMessages(serverGates), [serverGates]);
    const hardBlocked = useMemo(
        () => (typeof gatesForUi?.blocked === 'boolean' ? gatesForUi.blocked : serverGates.some((g) => g.severity === 'hard' && !g.resolved)),
        [gatesForUi?.blocked, serverGates],
    );

    const finalizeMutation = useMutation({
        mutationFn: async () => {
            if (view.context.encounterStatus === 'discharged') throw new Error('This encounter is already discharged.');
            // Initiate only when the server says the encounter has not entered discharge yet.
            if (view.context.encounterStatus !== 'discharge_initiated') {
                const init = await initiateDischarge(ctx, { encounterId: eid, patientId: patientId || undefined });
                if (!init.ok) throw new Error(formatAdtUserMessage(init));
            }
            const conf = await confirmDischarge(ctx, { encounterId: eid, patientId: patientId || undefined });
            if (!conf.ok) {
                const gates = dischargeBlockingGates(conf);
                throw new Error(gates.length ? `Discharge blocked: ${gates.map((g) => g.message).join('; ')}` : formatAdtUserMessage(conf));
            }
        },
        onSuccess: () => {
            toast.success('Patient successfully discharged');
            const returnTo = searchParams.get('returnTo');
            navigate(returnTo === 'bed-board' ? '/app/bed-board' : '/app/patients/list');
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : 'Finalize discharge failed');
            void queryClient.invalidateQueries({ queryKey: ['dischargeFinalizeReadiness', eid] });
        },
    });

    const canFinalize = Boolean(!hardBlocked && !finalizeMutation.isPending && !readinessQuery.isLoading && finReady);

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
