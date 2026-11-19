import { USE_CARE_PLAN_MOCK } from '../config/carePlanMock.config';
import {
    mockCreateCarePlan,
    mockGetCarePlan,
    mockSearchNanda,
    mockUpdateCarePlan,
    mockUpdateGoalStatus,
    mockEnsureEmptyPlan,
} from '../mock/mockCarePlanStore';
import type {
    CarePlanCreatePayload,
    CarePlanDataSource,
    CarePlanDocument,
    CarePlanGoalStatusPayload,
    CarePlanUpdatePayload,
    NandaSearchResult,
} from '../types/carePlan.types';
import {
    apiCreateCarePlan,
    apiGetCarePlanByEncounter,
    apiSearchNanda,
    apiUpdateCarePlan,
    apiUpdateGoalStatus,
} from './carePlanApi';


/**
 * Data source is a pure switch: real API unless VITE_CARE_PLAN_MOCK=true. There is no timeout-to-mock
 * or error-to-mock path any more — a failing API surfaces as an error in the UI instead of silently
 * showing fabricated plan data.
 */
export function getLastCarePlanDataSource(_encounterId: string): CarePlanDataSource | null {
    return USE_CARE_PLAN_MOCK ? 'mock' : 'api';
}

function pick<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
    return USE_CARE_PLAN_MOCK ? mockFn() : apiFn();
}

export async function searchNandaDiagnoses(q: string): Promise<NandaSearchResult[]> {
    return pick(() => apiSearchNanda(q), async () => mockSearchNanda(q));
}

export async function fetchCarePlan(
    encounterId: string,
    patientId: string,
    tenantId: string
): Promise<CarePlanDocument> {
    const enc = encounterId.trim();
    const empty = () => mockEnsureEmptyPlan(patientId, enc, tenantId);
    return pick(
        async () => (await apiGetCarePlanByEncounter(enc)) ?? empty(),
        async () => mockGetCarePlan(enc, patientId, tenantId) ?? empty()
    );
}

export async function createCarePlan(
    payload: CarePlanCreatePayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    return pick(() => apiCreateCarePlan(payload), () => mockCreateCarePlan(payload, reviewer));
}

export async function saveCarePlan(
    planId: string,
    payload: CarePlanUpdatePayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    return pick(() => apiUpdateCarePlan(planId, payload), () => mockUpdateCarePlan(planId, payload, reviewer));
}

export async function patchGoalStatus(
    planId: string,
    _encounterId: string,
    payload: CarePlanGoalStatusPayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    return pick(() => apiUpdateGoalStatus(planId, payload), () => mockUpdateGoalStatus(planId, payload, reviewer));
}
