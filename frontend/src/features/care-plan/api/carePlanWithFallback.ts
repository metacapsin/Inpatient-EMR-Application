import { CARE_PLAN_API_TIMEOUT_MS, USE_CARE_PLAN_MOCK } from '../config/carePlanMock.config';
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

const lastSourceByEncounter = new Map<string, CarePlanDataSource>();

export function getLastCarePlanDataSource(encounterId: string): CarePlanDataSource | null {
    return lastSourceByEncounter.get(encounterId.trim()) ?? null;
}

function setSource(encounterId: string, source: CarePlanDataSource): void {
    lastSourceByEncounter.set(encounterId.trim(), source);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('CARE_PLAN_API_TIMEOUT')), ms);
        promise
            .then((v) => {
                clearTimeout(timer);
                resolve(v);
            })
            .catch((e) => {
                clearTimeout(timer);
                reject(e);
            });
    });
}

async function callApi<T>(fn: () => Promise<T>): Promise<T> {
    if (!USE_CARE_PLAN_MOCK) return fn();
    return withTimeout(fn(), CARE_PLAN_API_TIMEOUT_MS);
}

function useMockOnly(encounterId: string): boolean {
    return USE_CARE_PLAN_MOCK && getLastCarePlanDataSource(encounterId) === 'mock';
}

async function withFallback<T>(
    encounterId: string,
    apiFn: () => Promise<T>,
    mockFn: () => Promise<T>
): Promise<T> {
    if (!USE_CARE_PLAN_MOCK) {
        const data = await apiFn();
        setSource(encounterId, 'api');
        return data;
    }
    if (useMockOnly(encounterId)) {
        const data = await mockFn();
        setSource(encounterId, 'mock');
        return data;
    }
    try {
        const data = await callApi(apiFn);
        setSource(encounterId, 'api');
        return data;
    } catch {
        const data = await mockFn();
        setSource(encounterId, 'mock');
        return data;
    }
}

export async function searchNandaDiagnoses(q: string): Promise<NandaSearchResult[]> {
    if (!USE_CARE_PLAN_MOCK) {
        try {
            return await apiSearchNanda(q);
        } catch {
            return mockSearchNanda(q);
        }
    }
    try {
        return await withTimeout(apiSearchNanda(q), CARE_PLAN_API_TIMEOUT_MS);
    } catch {
        return mockSearchNanda(q);
    }
}

export async function fetchCarePlan(
    encounterId: string,
    patientId: string,
    tenantId: string
): Promise<CarePlanDocument> {
    const enc = encounterId.trim();
    const empty = () => mockEnsureEmptyPlan(patientId, enc, tenantId);
    return withFallback(
        enc,
        async () => (await apiGetCarePlanByEncounter(enc)) ?? empty(),
        async () => mockGetCarePlan(enc, patientId, tenantId) ?? empty()
    );
}

export async function createCarePlan(
    payload: CarePlanCreatePayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    const enc = payload.encounterId.trim();
    return withFallback(
        enc,
        () => apiCreateCarePlan(payload),
        () => mockCreateCarePlan(payload, reviewer)
    );
}

export async function saveCarePlan(
    planId: string,
    payload: CarePlanUpdatePayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    const enc = payload.encounterId.trim();
    return withFallback(
        enc,
        () => apiUpdateCarePlan(planId, payload),
        () => mockUpdateCarePlan(planId, payload, reviewer)
    );
}

export async function patchGoalStatus(
    planId: string,
    encounterId: string,
    payload: CarePlanGoalStatusPayload,
    reviewer: { id: string; name: string }
): Promise<CarePlanDocument> {
    const enc = encounterId.trim();
    return withFallback(
        enc,
        () => apiUpdateGoalStatus(planId, payload),
        () => mockUpdateGoalStatus(planId, payload, reviewer)
    );
}
