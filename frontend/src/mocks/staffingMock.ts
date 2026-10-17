import type {
    AssignedBedChip,
    FloatPoolNurse,
    NurseAssignmentRow,
    RatioCheckResult,
    StaffingAssignmentBoard,
    UnitCareModel,
    UpdateStaffingAssignmentPayload,
} from '../types/staffing.types';
import { recomputeBoard, recomputeNurseRow } from '../features/staff-scheduling/live-assignments/utils/staffingDerived';
import { ratioStatusForPatientCount, resolveUnitCareModel } from '../features/staff-scheduling/live-assignments/utils/ratioStatus';
import type { StaffingShiftToken } from '../features/staff-scheduling/live-assignments/config/staffingMock.config';

function mockDelay<T>(value: T, ms = 140): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const WARD_META: Record<string, { name: string; careModel: UnitCareModel }> = {
    '1': { name: 'ICU', careModel: 'ICU' },
    '2': { name: 'Medical–Surgical 3 East', careModel: 'Med-Surg' },
    '3': { name: 'Telemetry 2 West', careModel: 'Step-Down' },
};

function bed(
    bedId: string,
    roomBedLabel: string,
    patientInitials: string,
    acuity: AssignedBedChip['acuity'],
    isolation = false
): AssignedBedChip {
    return {
        bedId,
        roomBedLabel,
        patientId: `pt-${bedId}`,
        patientInitials,
        acuity,
        isolation,
    };
}

function nurseRow(
    id: string,
    nurseId: string,
    displayName: string,
    role: NurseAssignmentRow['role'],
    assignedBeds: AssignedBedChip[],
    careModel: UnitCareModel,
    extras?: Partial<NurseAssignmentRow>
): NurseAssignmentRow {
    return recomputeNurseRow(
        {
            id,
            nurseId,
            displayName,
            role,
            assignedBeds,
            patientCount: assignedBeds.length,
            ratioStatus: ratioStatusForPatientCount(assignedBeds.length, careModel),
            hoursWorkedToday: extras?.hoursWorkedToday ?? 7.5,
            isFloatPool: extras?.isFloatPool ?? false,
            certifications: extras?.certifications ?? ['BLS'],
            isChargeNurse: extras?.isChargeNurse,
        },
        careModel
    );
}

function buildIcuBoard(unitId: string, date: string, shift: StaffingShiftToken): StaffingAssignmentBoard {
    const meta = WARD_META[unitId] ?? { name: 'ICU', careModel: 'ICU' as UnitCareModel };
    const nurses: NurseAssignmentRow[] = [
        nurseRow('na-1', 'staff-1', 'Jordan Lee, RN', 'RN', [
            bed('b-101a', '101A', 'JD', 'high'),
            bed('b-101b', '101B', 'MK', 'high', true),
        ], meta.careModel, { certifications: ['ACLS', 'CCRN', 'BLS'], isChargeNurse: true, hoursWorkedToday: 9.25 }),
        nurseRow('na-2', 'staff-2', 'Sam Patel, RN', 'RN', [
            bed('b-102a', '102A', 'RL', 'medium'),
            bed('b-102b', '102B', 'TN', 'high'),
            bed('b-103a', '103A', 'AW', 'high'),
        ], meta.careModel, { certifications: ['ACLS', 'CCRN', 'BLS'], hoursWorkedToday: 8.5 }),
        nurseRow('na-3', 'staff-8', 'Jamie Ortiz, RN', 'RN', [bed('b-104a', '104A', 'KP', 'medium')], meta.careModel, {
            certifications: ['ACLS', 'BLS'],
            isFloatPool: true,
        }),
        nurseRow('na-4', 'staff-cna-1', 'Rosa Nguyen, CNA', 'CNA', [], meta.careModel, { certifications: ['BLS'] }),
    ];

    return recomputeBoard({
        assignmentId: `assign-${unitId}-${date}-${shift}`,
        unitId,
        unitName: meta.name,
        unitCareModel: meta.careModel,
        date,
        shift,
        shiftLabel: shift === 'day' ? 'Day (7a–7p)' : shift === 'evening' ? 'Evening (3p–11p)' : 'Night (7p–7a)',
        chargeNurseId: 'staff-1',
        nurses,
        unfilledBedIds: ['b-105a'],
        totalPatients: 0,
    });
}

function buildMedSurgBoard(unitId: string, date: string, shift: StaffingShiftToken): StaffingAssignmentBoard {
    const meta = WARD_META[unitId] ?? { name: 'Med-Surg', careModel: 'Med-Surg' as UnitCareModel };
    const nurses: NurseAssignmentRow[] = [
        nurseRow('na-ms-1', 'staff-3', 'Alex Kim, RN', 'RN', [
            bed('b-301a', '301A', 'BH', 'low'),
            bed('b-301b', '301B', 'CS', 'medium'),
            bed('b-302a', '302A', 'DF', 'low'),
            bed('b-302b', '302B', 'EG', 'medium'),
            bed('b-303a', '303A', 'FH', 'low'),
            bed('b-303b', '303B', 'GI', 'medium'),
        ], meta.careModel, { certifications: ['ACLS', 'BLS'], isChargeNurse: true }),
        nurseRow('na-ms-2', 'staff-4', 'Morgan Chen, RN', 'RN', [
            bed('b-304a', '304A', 'HJ', 'low'),
            bed('b-304b', '304B', 'IK', 'low'),
            bed('b-305a', '305A', 'JL', 'medium'),
            bed('b-305b', '305B', 'KM', 'low'),
        ], meta.careModel, { certifications: ['TNCC', 'BLS'] }),
        nurseRow('na-ms-3', 'staff-10', 'Pat Rivera, RN', 'RN', [
            bed('b-306a', '306A', 'LN', 'low'),
            bed('b-306b', '306B', 'MO', 'medium'),
        ], meta.careModel, { certifications: ['BLS'], hoursWorkedToday: 10 }),
    ];

    return recomputeBoard({
        assignmentId: `assign-${unitId}-${date}-${shift}`,
        unitId,
        unitName: meta.name,
        unitCareModel: meta.careModel,
        date,
        shift,
        shiftLabel: shift === 'day' ? 'Day (7a–7p)' : shift === 'evening' ? 'Evening (3p–11p)' : 'Night (7p–7a)',
        chargeNurseId: 'staff-3',
        nurses,
        unfilledBedIds: ['b-307a', 'b-307b'],
        totalPatients: 0,
    });
}

function buildStepDownBoard(unitId: string, date: string, shift: StaffingShiftToken): StaffingAssignmentBoard {
    const meta = WARD_META[unitId] ?? { name: 'Telemetry', careModel: 'Step-Down' as UnitCareModel };
    const nurses: NurseAssignmentRow[] = [
        nurseRow('na-sd-1', 'staff-5', 'Taylor Brooks, RN', 'RN', [
            bed('b-210a', '210A', 'NP', 'medium'),
            bed('b-210b', '210B', 'OQ', 'high'),
            bed('b-211a', '211A', 'PR', 'medium'),
        ], meta.careModel, { certifications: ['ACLS', 'CCRN', 'BLS'], isChargeNurse: true }),
        nurseRow('na-sd-2', 'staff-9', 'Chris Davis, RN', 'RN', [
            bed('b-211b', '211B', 'QS', 'medium'),
            bed('b-212a', '212A', 'RT', 'high'),
            bed('b-212b', '212B', 'SU', 'medium'),
            bed('b-213a', '213A', 'TV', 'high'),
        ], meta.careModel, { certifications: ['ACLS', 'BLS'], hoursWorkedToday: 8.75 }),
    ];

    return recomputeBoard({
        assignmentId: `assign-${unitId}-${date}-${shift}`,
        unitId,
        unitName: meta.name,
        unitCareModel: meta.careModel,
        date,
        shift,
        shiftLabel: shift === 'day' ? 'Day (7a–7p)' : shift === 'evening' ? 'Evening (3p–11p)' : 'Night (7p–7a)',
        chargeNurseId: 'staff-5',
        nurses,
        unfilledBedIds: [],
        totalPatients: 0,
    });
}

const boards = new Map<string, StaffingAssignmentBoard>();

function boardKey(unitId: string, date: string, shift: string): string {
    return `${unitId}|${date}|${shift}`;
}

function seedBoard(unitId: string, date: string, shift: StaffingShiftToken): StaffingAssignmentBoard {
    const key = boardKey(unitId, date, shift);
    const existing = boards.get(key);
    if (existing) return structuredClone(existing);

    const careModel = WARD_META[unitId]?.careModel ?? resolveUnitCareModel({ name: unitId });
    let board: StaffingAssignmentBoard;
    if (careModel === 'ICU') board = buildIcuBoard(unitId, date, shift);
    else if (careModel === 'Med-Surg') board = buildMedSurgBoard(unitId, date, shift);
    else board = buildStepDownBoard(unitId, date, shift);

    boards.set(key, board);
    return structuredClone(board);
}

const FLOAT_POOL: FloatPoolNurse[] = [
    {
        id: 'float-1',
        displayName: 'Jamie Ortiz, RN',
        role: 'RN',
        certifications: ['ACLS', 'CCRN', 'BLS'],
        homeUnitName: 'Float Pool',
        available: false,
    },
    {
        id: 'float-2',
        displayName: 'Dana Wright, RN',
        role: 'RN',
        certifications: ['ACLS', 'TNCC', 'BLS'],
        homeUnitName: 'Float Pool',
        available: true,
    },
    {
        id: 'float-3',
        displayName: 'Evan Stone, LVN',
        role: 'LVN',
        certifications: ['BLS'],
        homeUnitName: 'Float Pool',
        available: true,
    },
];

export async function mockGetStaffingAssignment(
    unitId: string,
    date: string,
    shift: string
): Promise<StaffingAssignmentBoard | null> {
    if (!unitId) return null;
    return mockDelay(seedBoard(unitId, date, shift as StaffingShiftToken));
}

export async function mockCreateStaffingAssignment(
    unitId: string,
    date: string,
    shift: string,
    chargeNurseId?: string | null
): Promise<StaffingAssignmentBoard> {
    const board = seedBoard(unitId, date, shift as StaffingShiftToken);
    if (chargeNurseId) {
        board.chargeNurseId = chargeNurseId;
        board.nurses = board.nurses.map((n) => ({ ...n, isChargeNurse: n.nurseId === chargeNurseId }));
    }
    boards.set(boardKey(unitId, date, shift), board);
    return mockDelay(structuredClone(board));
}

export async function mockUpdateStaffingAssignment(
    assignmentId: string,
    payload: UpdateStaffingAssignmentPayload
): Promise<StaffingAssignmentBoard> {
    const entry = [...boards.entries()].find(([, b]) => b.assignmentId === assignmentId);
    if (!entry) throw new Error('Assignment not found');
    const [key, board] = entry;

    let next = structuredClone(board);
    if (payload.chargeNurseId !== undefined) {
        next.chargeNurseId = payload.chargeNurseId;
        next.nurses = next.nurses.map((n) => ({
            ...n,
            isChargeNurse: n.nurseId === payload.chargeNurseId,
        }));
    }

    for (const row of payload.nurseAssignments) {
        const patch = row.assignedBedIds;
        const allBeds = next.nurses.flatMap((n) => n.assignedBeds);
        next.nurses = next.nurses.map((n) => {
            if (n.id !== row.nurseAssignmentId) return n;
            const beds = patch
                .map((bedId) => allBeds.find((b) => b.bedId === bedId))
                .filter((b): b is AssignedBedChip => Boolean(b));
            return recomputeNurseRow({ ...n, assignedBeds: beds }, next.unitCareModel);
        });
    }

    next = recomputeBoard(next);
    boards.set(key, next);
    return mockDelay(structuredClone(next));
}

export async function mockGetFloatPool(_tenantId: string): Promise<FloatPoolNurse[]> {
    return mockDelay(FLOAT_POOL.map((n) => ({ ...n })));
}

export async function mockGetRatioCheck(unitId: string): Promise<RatioCheckResult | null> {
    const meta = WARD_META[unitId];
    if (!meta) return mockDelay(null);
    const board = seedBoard(unitId, new Date().toISOString().slice(0, 10), 'day');
    const criticalNurses = board.nurses
        .filter((n) => n.ratioStatus === 'critical')
        .map((n) => ({ nurseId: n.nurseId, displayName: n.displayName, patientCount: n.patientCount }));
    const clinical = board.nurses.filter((n) => n.role === 'RN' || n.role === 'LVN');
    const avg = board.totalPatients / Math.max(clinical.length, 1);
    const status =
        criticalNurses.length > 0
            ? 'critical'
            : board.nurses.some((n) => n.ratioStatus === 'warning')
              ? 'warning'
              : 'safe';
    return mockDelay({
        unitId,
        unitCareModel: meta.careModel,
        averageRatio: Math.round(avg * 10) / 10,
        status,
        criticalNurses,
        understaffed: status !== 'safe',
    });
}

export function mockApplyBoardUpdate(board: StaffingAssignmentBoard): void {
    boards.set(boardKey(board.unitId, board.date, board.shift), board);
}
