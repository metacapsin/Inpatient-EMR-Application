import {
    apiCreateStaffingAssignment,
    apiGetFloatPool,
    apiGetRatioCheck,
    apiGetStaffingAssignment,
    apiUpdateStaffingAssignment,
} from './staffingApi';
import { USE_STAFFING_MOCK } from '../config/staffingMock.config';
import {
    mockApplyBoardUpdate,
    mockCreateStaffingAssignment,
    mockGetFloatPool,
    mockGetRatioCheck,
    mockGetStaffingAssignment,
    mockUpdateStaffingAssignment,
} from '../../../../mocks/staffingMock';
import type {
    CreateStaffingAssignmentPayload,
    FloatPoolNurse,
    RatioCheckResult,
    StaffingAssignmentBoard,
    UpdateStaffingAssignmentPayload,
} from '../../../../types/staffing.types';

export type StaffingDataSource = 'api' | 'mock';

/** Pure switch: real API unless VITE_STAFFING_API_MOCK=true. No timeout/error fallback to fixture boards. */
export function getLastStaffingDataSource(): StaffingDataSource {
    return USE_STAFFING_MOCK ? 'mock' : 'api';
}

async function withMockFallback<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
    return USE_STAFFING_MOCK ? mockFn() : apiFn();
}

export async function fetchStaffingAssignment(
    unitId: string,
    date: string,
    shift: string
): Promise<StaffingAssignmentBoard | null> {
    return withMockFallback(
        () => apiGetStaffingAssignment(unitId, date, shift),
        () => mockGetStaffingAssignment(unitId, date, shift)
    );
}

export async function createStaffingAssignment(
    payload: CreateStaffingAssignmentPayload
): Promise<StaffingAssignmentBoard> {
    return withMockFallback(
        () => apiCreateStaffingAssignment(payload),
        () => mockCreateStaffingAssignment(payload.unitId, payload.date, payload.shift, payload.chargeNurseId)
    );
}

export async function updateStaffingAssignment(
    assignmentId: string,
    payload: UpdateStaffingAssignmentPayload,
    optimisticBoard?: StaffingAssignmentBoard
): Promise<StaffingAssignmentBoard> {
    if (optimisticBoard && getLastStaffingDataSource() === 'mock') {
        mockApplyBoardUpdate(optimisticBoard);
    }
    return withMockFallback(
        () => apiUpdateStaffingAssignment(assignmentId, payload),
        () => mockUpdateStaffingAssignment(assignmentId, payload)
    );
}

export async function fetchFloatPool(tenantId: string): Promise<FloatPoolNurse[]> {
    return withMockFallback(
        () => apiGetFloatPool(tenantId),
        () => mockGetFloatPool(tenantId)
    );
}

export async function fetchRatioCheck(unitId: string): Promise<RatioCheckResult | null> {
    return withMockFallback(
        () => apiGetRatioCheck(unitId),
        () => mockGetRatioCheck(unitId)
    );
}

export function buildUpdatePayload(board: StaffingAssignmentBoard): UpdateStaffingAssignmentPayload {
    return {
        chargeNurseId: board.chargeNurseId,
        nurseAssignments: board.nurses.map((n) => ({
            nurseAssignmentId: n.id,
            assignedBedIds: n.assignedBeds.map((b) => b.bedId),
        })),
    };
}
