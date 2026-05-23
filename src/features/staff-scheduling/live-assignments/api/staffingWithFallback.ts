import {
    apiCreateStaffingAssignment,
    apiGetFloatPool,
    apiGetRatioCheck,
    apiGetStaffingAssignment,
    apiUpdateStaffingAssignment,
} from './staffingApi';
import { STAFFING_API_TIMEOUT_MS, USE_STAFFING_MOCK } from '../config/staffingMock.config';
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

let lastSource: StaffingDataSource = USE_STAFFING_MOCK ? 'mock' : 'api';

export function getLastStaffingDataSource(): StaffingDataSource {
    return lastSource;
}

function setSource(source: StaffingDataSource): void {
    lastSource = source;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('STAFFING_API_TIMEOUT')), ms);
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
    if (!USE_STAFFING_MOCK) return fn();
    return withTimeout(fn(), STAFFING_API_TIMEOUT_MS);
}

async function withMockFallback<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
    if (!USE_STAFFING_MOCK) {
        const data = await apiFn();
        setSource('api');
        return data;
    }
    if (lastSource === 'mock') {
        const data = await mockFn();
        setSource('mock');
        return data;
    }
    try {
        const data = await callApi(apiFn);
        setSource('api');
        return data;
    } catch {
        const data = await mockFn();
        setSource('mock');
        return data;
    }
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
