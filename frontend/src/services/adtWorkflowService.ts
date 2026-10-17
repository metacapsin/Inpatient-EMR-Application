import type { QueryClient } from '@tanstack/react-query';
import type {
    AdmitRequest,
    AdmitResponseData,
    DischargeConfirmData,
    DischargeInitiateData,
    TransferRequest,
    TransferResponseData,
} from '../types/adt';
import type { AppDispatch } from '../store';
import {
    adtApi,
    activeEncounterRowsToAdtMergePayload,
    listActiveEncounters,
    resolveBedMongoIdAfterAdmit,
    type AdtPostResult,
    type ListActiveEncountersResult,
} from './adt.service';
import { invalidateAdtSurfaces } from '../lib/adtInvalidate';
import {
    clearAdtEncounter,
    mergeActiveEncountersFromServer,
    setAdtAfterAdmit,
    setAdtCurrentBed,
    setAdtDischargeInitiated,
} from '../store/adtEncounterSlice';

/**
 * Central ADT workflow context: every mutation must receive the same Redux dispatch and QueryClient
 * so bed board, dashboards, and placement views invalidate together.
 */
export type AdtWorkflowContext = {
    dispatch: AppDispatch;
    queryClient: QueryClient;
};

export async function mergeServerEncountersIntoStore(
    ctx: AdtWorkflowContext,
    params?: { patientId?: string }
): Promise<ListActiveEncountersResult> {
    const res = await listActiveEncounters(params);
    if (res.ok) {
        ctx.dispatch(mergeActiveEncountersFromServer(activeEncounterRowsToAdtMergePayload(res.data)));
    }
    return res;
}

export function refreshAdtSurfaces(ctx: AdtWorkflowContext): void {
    invalidateAdtSurfaces(ctx.queryClient);
}

export async function admitPatient(
    ctx: AdtWorkflowContext,
    payload: AdmitRequest
): Promise<AdtPostResult<AdmitResponseData>> {
    const result = await adtApi.admit(payload);
    if (!result.ok) return result;
    const encId = result.data.encounter?.id;
    if (encId) {
        const encObj = result.data.encounter as Record<string, unknown> | undefined;
        const bedMongoId = resolveBedMongoIdAfterAdmit(encObj, payload.bedId.trim());
        ctx.dispatch(
            setAdtAfterAdmit({
                patientId: payload.patientId.trim(),
                encounterId: encId,
                bedMongoId,
            })
        );
    }
    refreshAdtSurfaces(ctx);
    await mergeServerEncountersIntoStore(ctx, { patientId: payload.patientId.trim() });
    return result;
}

export type TransferPatientPayload = TransferRequest & { patientId?: string };

export async function transferPatient(
    ctx: AdtWorkflowContext,
    payload: TransferPatientPayload
): Promise<AdtPostResult<TransferResponseData>> {
    const { patientId, ...body } = payload;
    const result = await adtApi.transfer(body);
    if (!result.ok) return result;
    const pid = patientId?.trim();
    const nextBed = result.data.currentBedId?.trim() || body.newBedId.trim();
    if (pid && nextBed) {
        ctx.dispatch(setAdtCurrentBed({ patientId: pid, bedMongoId: nextBed, fromTransfer: true }));
    }
    refreshAdtSurfaces(ctx);
    if (pid) await mergeServerEncountersIntoStore(ctx, { patientId: pid });
    else await mergeServerEncountersIntoStore(ctx);
    return result;
}

export type InitiateDischargeArgs = {
    encounterId: string;
    patientId?: string;
    disposition?: string;
    dischargeSummary?: string;
};

export async function initiateDischarge(
    ctx: AdtWorkflowContext,
    args: InitiateDischargeArgs
): Promise<AdtPostResult<DischargeInitiateData>> {
    const encounterId = args.encounterId.trim();
    const result = await adtApi.dischargeInitiate(encounterId, args.disposition, args.dischargeSummary);
    if (result.ok) {
        const pid = args.patientId?.trim();
        if (pid) {
            ctx.dispatch(setAdtDischargeInitiated({ patientId: pid, encounterId }));
        }
        refreshAdtSurfaces(ctx);
        void ctx.queryClient.invalidateQueries({ queryKey: ['dischargeFinalizeReadiness', encounterId] });
    }
    return result;
}

export type ConfirmDischargeArgs = {
    encounterId: string;
    patientId?: string;
};

export async function confirmDischarge(
    ctx: AdtWorkflowContext,
    args: ConfirmDischargeArgs
): Promise<AdtPostResult<DischargeConfirmData>> {
    const encounterId = args.encounterId.trim();
    const result = await adtApi.dischargeConfirm(encounterId);
    if (!result.ok) return result;
    const pid = args.patientId?.trim();
    if (pid) ctx.dispatch(clearAdtEncounter({ patientId: pid }));
    refreshAdtSurfaces(ctx);
    await mergeServerEncountersIntoStore(ctx, pid ? { patientId: pid } : undefined);
    void ctx.queryClient.invalidateQueries({ queryKey: ['dischargeFinalizeReadiness', encounterId] });
    return result;
}

export { formatAdtUserMessage } from './adt.service';
