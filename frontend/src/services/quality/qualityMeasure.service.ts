import api from '../api';
import type {
    BundleKey,
    EvaluateEncounterResponse,
    QualityDashboardResponse,
    QualityMeasureEncounterResponse,
    UpdateMeasureElementPayload,
    UpdateMeasureElementResponse,
} from '../../types/quality';
import {
    getMockDashboard,
    getMockEncounterMeasure,
    mockEvaluateEncounter,
    mockUpdateElement,
} from '../../mock/quality/qualityMockStore';

/** Set `VITE_QUALITY_MEASURE_MOCK=false` when backend routes are live. */
export const USE_QUALITY_MEASURE_MOCK = import.meta.env.VITE_QUALITY_MEASURE_MOCK !== 'false';

const API_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('QUALITY_MEASURE_API_TIMEOUT')), ms);
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

function unwrapData<T>(data: unknown): T | null {
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    if (o.status === 'success' && o.data != null) return o.data as T;
    if ('unitId' in o || 'encounterId' in o || 'element' in o) return o as T;
    return null;
}

async function fetchDashboardApi(unitId: string): Promise<QualityDashboardResponse> {
    const { data } = await api.get<unknown>(
        `/api/QualityMeasure/dashboard/${encodeURIComponent(unitId)}`,
    );
    const inner = unwrapData<QualityDashboardResponse>(data);
    if (!inner) throw new Error('Invalid dashboard response');
    return inner;
}

async function fetchEncounterApi(encounterId: string): Promise<QualityMeasureEncounterResponse> {
    const { data } = await api.get<unknown>(
        `/api/QualityMeasure/encounter/${encodeURIComponent(encounterId)}`,
    );
    const inner = unwrapData<QualityMeasureEncounterResponse>(data);
    if (!inner) throw new Error('Invalid encounter measure response');
    return inner;
}

async function putElementApi(
    measureId: string,
    payload: UpdateMeasureElementPayload,
): Promise<UpdateMeasureElementResponse> {
    const { data } = await api.put<unknown>(
        `/api/QualityMeasure/${encodeURIComponent(measureId)}/element`,
        payload,
    );
    const inner = unwrapData<UpdateMeasureElementResponse>(data);
    if (!inner?.element) throw new Error('Invalid element update response');
    return inner;
}

async function postEvaluateApi(encounterId: string): Promise<EvaluateEncounterResponse> {
    const { data } = await api.post<unknown>(
        `/api/QualityMeasure/evaluate/${encodeURIComponent(encounterId)}`,
    );
    const inner = unwrapData<EvaluateEncounterResponse>(data);
    if (!inner) throw new Error('Invalid evaluate response');
    return inner;
}

/** GET /api/QualityMeasure/dashboard/:unitId */
export async function getQualityDashboard(unitId: string): Promise<QualityDashboardResponse> {
    const id = unitId.trim() || 'unit-ms-6e';

    if (!USE_QUALITY_MEASURE_MOCK) {
        return fetchDashboardApi(id);
    }

    try {
        return await withTimeout(fetchDashboardApi(id), API_TIMEOUT_MS);
    } catch {
        return getMockDashboard(id);
    }
}

/** GET /api/QualityMeasure/encounter/:encounterId — bundle detail uses encounter + bundle context */
export async function getQualityEncounterMeasure(
    encounterId: string,
    bundleKey: BundleKey,
): Promise<QualityMeasureEncounterResponse> {
    const id = encounterId.trim();
    if (!id) throw new Error('encounterId required');

    if (!USE_QUALITY_MEASURE_MOCK) {
        const res = await fetchEncounterApi(id);
        return { ...res, bundleKey, bundleLabel: res.bundleLabel };
    }

    try {
        const res = await withTimeout(fetchEncounterApi(id), API_TIMEOUT_MS);
        return res.bundleKey === bundleKey ? res : { ...res, bundleKey };
    } catch {
        const mock = await getMockEncounterMeasure(id, bundleKey);
        if (!mock) throw new Error('Encounter not found');
        return mock;
    }
}

/** PUT /api/QualityMeasure/:measureId/element */
export async function updateQualityMeasureElement(
    measureId: string,
    payload: UpdateMeasureElementPayload,
): Promise<UpdateMeasureElementResponse> {
    if (!USE_QUALITY_MEASURE_MOCK) {
        return putElementApi(measureId, payload);
    }

    try {
        return await withTimeout(putElementApi(measureId, payload), API_TIMEOUT_MS);
    } catch {
        const element = await mockUpdateElement(measureId, payload);
        if (!element) throw new Error('Element not found');
        return { measureId, element };
    }
}

/** POST /api/QualityMeasure/evaluate/:encounterId */
export async function evaluateQualityEncounter(
    encounterId: string,
): Promise<EvaluateEncounterResponse> {
    const id = encounterId.trim();
    if (!id) throw new Error('encounterId required');

    if (!USE_QUALITY_MEASURE_MOCK) {
        return postEvaluateApi(id);
    }

    try {
        return await withTimeout(postEvaluateApi(id), API_TIMEOUT_MS);
    } catch {
        const { evaluatedAt } = await mockEvaluateEncounter(id);
        return { encounterId: id, evaluatedAt, success: true };
    }
}
