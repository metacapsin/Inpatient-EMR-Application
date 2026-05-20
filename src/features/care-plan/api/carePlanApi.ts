import api from '../../../services/api';
import type {
    CarePlanCreatePayload,
    CarePlanDocument,
    CarePlanGoalStatusPayload,
    CarePlanUpdatePayload,
    NandaSearchResult,
} from '../types/carePlan.types';
import { unwrapCarePlanPayload, unwrapNandaSearch } from '../utils/carePlanMappers';

export async function apiSearchNanda(q: string): Promise<NandaSearchResult[]> {
    const { data } = await api.get<unknown>('/api/CarePlan/nanda/search', { params: { q } });
    return unwrapNandaSearch(data);
}

export async function apiCreateCarePlan(payload: CarePlanCreatePayload): Promise<CarePlanDocument> {
    const { data } = await api.post<unknown>('/api/CarePlan/create', payload);
    const plan = unwrapCarePlanPayload(data);
    if (!plan) throw new Error('Unexpected create response');
    return plan;
}

export async function apiGetCarePlanByEncounter(encounterId: string): Promise<CarePlanDocument | null> {
    const { data } = await api.get<unknown>(`/api/CarePlan/${encodeURIComponent(encounterId)}`);
    return unwrapCarePlanPayload(data);
}

export async function apiUpdateCarePlan(planId: string, payload: CarePlanUpdatePayload): Promise<CarePlanDocument> {
    const { data } = await api.put<unknown>(`/api/CarePlan/${encodeURIComponent(planId)}`, payload);
    const plan = unwrapCarePlanPayload(data);
    if (!plan) throw new Error('Unexpected update response');
    return plan;
}

export async function apiUpdateGoalStatus(planId: string, payload: CarePlanGoalStatusPayload): Promise<CarePlanDocument> {
    const { data } = await api.put<unknown>(`/api/CarePlan/${encodeURIComponent(planId)}/goalStatus`, payload);
    const plan = unwrapCarePlanPayload(data);
    if (!plan) throw new Error('Unexpected goal status response');
    return plan;
}
