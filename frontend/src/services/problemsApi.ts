import api from './api';
import { asRecord, unwrapList } from '../lib/apiPayload';

export type ProblemStatus = 'active' | 'inactive' | 'resolved' | 'entered_in_error';
export type ProblemChronicity = 'acute' | 'chronic';

export interface Icd10SearchHit {
    code: string;
    description: string;
    billable?: boolean;
    effectiveYear?: number;
}

export interface PatientProblem {
    id: string;
    tenantId: string;
    patientId: string;
    encounterId?: string | null;
    icd10Code: string;
    icd10Description: string;
    status: ProblemStatus;
    chronicity?: ProblemChronicity | null;
    onsetDate?: string | null;
    resolvedDate?: string | null;
    notedBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateProblemPayload {
    icd10Code: string;
    encounterId?: string | null;
    chronicity?: ProblemChronicity | null;
    onsetDate?: string | null;
    status?: 'active' | 'inactive';
}

export interface UpdateProblemPayload {
    status?: ProblemStatus;
    chronicity?: ProblemChronicity | null;
    onsetDate?: string | null;
    resolvedDate?: string | null;
    encounterId?: string | null;
}

function unwrapData<T>(payload: unknown): T | null {
    const o = asRecord(payload);
    if (!o) return null;
    const st = typeof o.status === 'string' ? o.status.toLowerCase() : '';
    if ((st === 'success' || st === 'ok') && o.data !== undefined) return o.data as T;
    return payload as T;
}

function coerceProblem(raw: unknown): PatientProblem | null {
    const r = asRecord(raw);
    if (!r) return null;
    const id = String(r.id ?? r._id ?? '').trim();
    const icd10Code = String(r.icd10Code ?? r.icd10_code ?? '').trim();
    const icd10Description = String(r.icd10Description ?? r.icd10_description ?? '').trim();
    if (!id || !icd10Code) return null;
    const statusRaw = String(r.status ?? 'active').toLowerCase();
    const status: ProblemStatus =
        statusRaw === 'inactive' || statusRaw === 'resolved' || statusRaw === 'entered_in_error'
            ? statusRaw
            : 'active';
    const chronRaw = r.chronicity == null ? null : String(r.chronicity).toLowerCase();
    const chronicity: ProblemChronicity | null =
        chronRaw === 'acute' || chronRaw === 'chronic' ? chronRaw : null;
    return {
        id,
        tenantId: String(r.tenantId ?? r.tenant_id ?? ''),
        patientId: String(r.patientId ?? r.patient_id ?? ''),
        encounterId: (r.encounterId ?? r.encounter_id ?? null) as string | null,
        icd10Code,
        icd10Description,
        status,
        chronicity,
        onsetDate: (r.onsetDate ?? r.onset_date ?? null) as string | null,
        resolvedDate: (r.resolvedDate ?? r.resolved_date ?? null) as string | null,
        notedBy: (r.notedBy ?? r.noted_by ?? null) as string | null,
        createdAt: (r.createdAt ?? r.created_at) as string | undefined,
        updatedAt: (r.updatedAt ?? r.updated_at) as string | undefined,
    };
}

function coerceIcdHit(raw: unknown): Icd10SearchHit | null {
    const r = asRecord(raw);
    if (!r) return null;
    const code = String(r.code ?? '').trim();
    const description = String(r.description ?? '').trim();
    if (!code || !description) return null;
    return {
        code,
        description,
        billable: typeof r.billable === 'boolean' ? r.billable : undefined,
        effectiveYear:
            typeof r.effectiveYear === 'number'
                ? r.effectiveYear
                : typeof r.effective_year === 'number'
                  ? r.effective_year
                  : undefined,
    };
}

export async function searchIcd10(q: string, signal?: AbortSignal): Promise<Icd10SearchHit[]> {
    const term = q.trim();
    if (!term) return [];
    const { data } = await api.get('/api/icd10/search', { params: { q: term }, signal });
    return unwrapList(data).map(coerceIcdHit).filter((x): x is Icd10SearchHit => x !== null);
}

export async function listPatientProblems(
    patientId: string,
    opts?: { includeResolved?: boolean; signal?: AbortSignal }
): Promise<PatientProblem[]> {
    const { data } = await api.get(`/api/patients/${encodeURIComponent(patientId)}/problems`, {
        params: opts?.includeResolved ? { includeResolved: 'true' } : undefined,
        signal: opts?.signal,
    });
    return unwrapList(data).map(coerceProblem).filter((x): x is PatientProblem => x !== null);
}

export async function createPatientProblem(
    patientId: string,
    payload: CreateProblemPayload
): Promise<PatientProblem> {
    const { data } = await api.post(`/api/patients/${encodeURIComponent(patientId)}/problems`, payload);
    const inner = unwrapData<unknown>(data);
    const problem = coerceProblem(inner);
    if (!problem) throw new Error('Invalid create problem response');
    return problem;
}

export async function updateProblem(id: string, payload: UpdateProblemPayload): Promise<PatientProblem> {
    const { data } = await api.patch(`/api/problems/${encodeURIComponent(id)}`, payload);
    const inner = unwrapData<unknown>(data);
    const problem = coerceProblem(inner);
    if (!problem) throw new Error('Invalid update problem response');
    return problem;
}

export function groupProblemsForDisplay(problems: PatientProblem[]): {
    activeChronic: PatientProblem[];
    activeAcute: PatientProblem[];
    activeUnspecified: PatientProblem[];
    inactive: PatientProblem[];
    resolved: PatientProblem[];
} {
    const activeChronic: PatientProblem[] = [];
    const activeAcute: PatientProblem[] = [];
    const activeUnspecified: PatientProblem[] = [];
    const inactive: PatientProblem[] = [];
    const resolved: PatientProblem[] = [];
    for (const p of problems) {
        if (p.status === 'active' && p.chronicity === 'chronic') activeChronic.push(p);
        else if (p.status === 'active' && p.chronicity === 'acute') activeAcute.push(p);
        else if (p.status === 'active') activeUnspecified.push(p);
        else if (p.status === 'inactive') inactive.push(p);
        else if (p.status === 'resolved') resolved.push(p);
    }
    return { activeChronic, activeAcute, activeUnspecified, inactive, resolved };
}
