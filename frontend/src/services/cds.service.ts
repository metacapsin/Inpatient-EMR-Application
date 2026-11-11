import { z } from 'zod';
import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';
import {
    cdsAlertSchema,
    cdsRuleRowSchema,
    drugHitSchema,
    type CdsAlert,
    type CdsOverrideSeverity,
    type CdsRuleRow,
    type DrugHit,
} from '../types/cds';

type Envelope<T> = { status: string; message?: string; data?: T; code?: string; details?: unknown };

const unwrap = <T>(body: unknown): T =>
    body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: T }).data : (body as T);

export async function searchDrugs(q: string): Promise<ServiceResult<DrugHit[]>> {
    try {
        const { data } = await api.get<Envelope<unknown>>('/api/drugs/search', { params: { q } });
        const parsed = z.array(drugHitSchema).parse(unwrap(data) ?? []);
        return { ok: true, data: parsed };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Drug search failed') };
    }
}

export async function checkInteractions(
    patientId: string,
    candidates: Array<{ name: string; rxnormCode?: string | null }>,
): Promise<ServiceResult<CdsAlert[]>> {
    try {
        const { data } = await api.post<Envelope<unknown>>('/api/cds/check', { patientId, candidates });
        const parsed = z.array(cdsAlertSchema).parse(unwrap(data) ?? []);
        return { ok: true, data: parsed };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Interaction check failed') };
    }
}

export async function listCdsRules(): Promise<ServiceResult<CdsRuleRow[]>> {
    try {
        const { data } = await api.get<Envelope<unknown>>('/api/cds/rules');
        const parsed = z.array(cdsRuleRowSchema).parse(unwrap(data) ?? []);
        return { ok: true, data: parsed };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not load CDS rules') };
    }
}

export async function setSeverityOverride(ruleId: string, severity: CdsOverrideSeverity): Promise<ServiceResult<{ ruleId: string; severity: string }>> {
    try {
        const { data } = await api.put<Envelope<{ ruleId: string; severity: string }>>(
            `/api/cds/severity-overrides/${encodeURIComponent(ruleId)}`,
            { severity },
        );
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not save severity override') };
    }
}

export async function clearSeverityOverride(ruleId: string): Promise<ServiceResult<{ deleted: boolean }>> {
    try {
        const { data } = await api.delete<Envelope<{ deleted: boolean }>>(`/api/cds/severity-overrides/${encodeURIComponent(ruleId)}`);
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not clear severity override') };
    }
}

/** Extract CDS alerts from a 409 CDS_OVERRIDE_REQUIRED Axios error. */
export function cdsAlertsFromError(err: unknown): CdsAlert[] | null {
    const ax = err as { response?: { status?: number; data?: { code?: string; details?: { alerts?: unknown } } } };
    if (ax.response?.status !== 409 || ax.response.data?.code !== 'CDS_OVERRIDE_REQUIRED') return null;
    const parsed = z.array(cdsAlertSchema).safeParse(ax.response.data.details?.alerts ?? []);
    return parsed.success ? parsed.data : null;
}
