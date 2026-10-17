import api from '../../../../services/api';
import type {
    CreateStaffingAssignmentPayload,
    FloatPoolNurse,
    RatioCheckResult,
    StaffingAssignmentBoard,
    UpdateStaffingAssignmentPayload,
} from '../../../../types/staffing.types';

type ApiEnvelope<T> = { data?: T; status?: string; message?: string };

function unwrapOne<T>(raw: unknown): T | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (o.data && typeof o.data === 'object') return o.data as T;
    return raw as T;
}

function unwrapList<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object') {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.data)) return o.data as T[];
    }
    return [];
}

export async function apiGetStaffingAssignment(
    unitId: string,
    date: string,
    shift: string
): Promise<StaffingAssignmentBoard | null> {
    try {
        const { data } = await api.get<ApiEnvelope<StaffingAssignmentBoard> | StaffingAssignmentBoard>(
            `/api/Staffing/assignment/${encodeURIComponent(unitId)}/${encodeURIComponent(date)}/${encodeURIComponent(shift)}`
        );
        return unwrapOne<StaffingAssignmentBoard>(data);
    } catch (e) {
        // No board yet for this unit/date/shift: the caller creates one.
        if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
        throw e;
    }
}

export async function apiCreateStaffingAssignment(
    payload: CreateStaffingAssignmentPayload
): Promise<StaffingAssignmentBoard> {
    const { data } = await api.post<ApiEnvelope<StaffingAssignmentBoard> | StaffingAssignmentBoard>(
        '/api/Staffing/assignment',
        payload
    );
    return unwrapOne<StaffingAssignmentBoard>(data) ?? (data as StaffingAssignmentBoard);
}

export async function apiUpdateStaffingAssignment(
    assignmentId: string,
    payload: UpdateStaffingAssignmentPayload
): Promise<StaffingAssignmentBoard> {
    const { data } = await api.put<ApiEnvelope<StaffingAssignmentBoard> | StaffingAssignmentBoard>(
        `/api/Staffing/assignment/${encodeURIComponent(assignmentId)}`,
        payload
    );
    return unwrapOne<StaffingAssignmentBoard>(data) ?? (data as StaffingAssignmentBoard);
}

export async function apiGetFloatPool(tenantId: string): Promise<FloatPoolNurse[]> {
    const { data } = await api.get<ApiEnvelope<FloatPoolNurse[]> | FloatPoolNurse[]>(
        `/api/Staffing/floatPool/${encodeURIComponent(tenantId)}`
    );
    if (data && typeof data === 'object' && 'data' in data) {
        return unwrapList<FloatPoolNurse>((data as ApiEnvelope<FloatPoolNurse[]>).data);
    }
    return unwrapList<FloatPoolNurse>(data);
}

export async function apiGetRatioCheck(unitId: string): Promise<RatioCheckResult | null> {
    const { data } = await api.get<ApiEnvelope<RatioCheckResult> | RatioCheckResult>(
        `/api/Staffing/ratioCheck/${encodeURIComponent(unitId)}`
    );
    return unwrapOne<RatioCheckResult>(data);
}
