import type {
    FloatPoolNurse,
    NurseAssignmentRow,
    StaffingAlertItem,
    StaffingAssignmentBoard,
    StaffingKpiSnapshot,
    UnitCareModel,
} from '../../../../types/staffing.types';
import {
    averagePatientRatio,
    OVERTIME_HOURS_THRESHOLD,
    ratioStatusForPatientCount,
    resolveUnitCareModel,
} from './ratioStatus';

export function deriveKpis(board: StaffingAssignmentBoard | null): StaffingKpiSnapshot {
    if (!board) {
        return {
            totalPatients: 0,
            totalNurses: 0,
            averageRatio: 0,
            overtimeStaffCount: 0,
            unfilledBeds: 0,
        };
    }
    const clinicalNurses = board.nurses.filter((n) => n.role === 'RN' || n.role === 'LVN');
    return {
        totalPatients: board.totalPatients,
        totalNurses: clinicalNurses.length,
        averageRatio: averagePatientRatio(board.totalPatients, clinicalNurses.length || 1),
        overtimeStaffCount: board.nurses.filter((n) => n.hoursWorkedToday > OVERTIME_HOURS_THRESHOLD).length,
        unfilledBeds: board.unfilledBedIds.length,
    };
}

export function recomputeNurseRow(
    row: NurseAssignmentRow,
    careModel: UnitCareModel
): NurseAssignmentRow {
    const patientCount = row.assignedBeds.length;
    return {
        ...row,
        patientCount,
        ratioStatus: ratioStatusForPatientCount(patientCount, careModel),
    };
}

export function recomputeBoard(board: StaffingAssignmentBoard): StaffingAssignmentBoard {
    const nurses = board.nurses.map((n) => recomputeNurseRow(n, board.unitCareModel));
    const assignedIds = new Set(nurses.flatMap((n) => n.assignedBeds.map((b) => b.bedId)));
    const unfilledBedIds = board.unfilledBedIds.filter((id) => !assignedIds.has(id));
    const totalPatients = nurses.reduce((sum, n) => sum + n.patientCount, 0) + unfilledBedIds.length;
    return { ...board, nurses, unfilledBedIds, totalPatients };
}

export function buildStaffingAlerts(args: {
    board: StaffingAssignmentBoard | null;
    openShiftCount: number;
    floatPool: FloatPoolNurse[];
}): StaffingAlertItem[] {
    const alerts: StaffingAlertItem[] = [];
    const { board, openShiftCount, floatPool } = args;

    if (board) {
        const criticalNurses = board.nurses.filter((n) => n.ratioStatus === 'critical');
        if (criticalNurses.length > 0) {
            alerts.push({
                id: 'ratio-critical',
                severity: 'critical',
                message: `${board.unitName} ratio critical — ${criticalNurses.length} nurse${criticalNurses.length === 1 ? '' : 's'} over threshold`,
            });
        } else {
            const warningNurses = board.nurses.filter((n) => n.ratioStatus === 'warning');
            if (warningNurses.length > 0) {
                alerts.push({
                    id: 'ratio-warning',
                    severity: 'warning',
                    message: `${board.unitName} ratio warning — ${warningNurses.length} assignment${warningNurses.length === 1 ? '' : 's'} above safe ratio`,
                });
            }
        }

        if (board.unfilledBedIds.length > 0) {
            alerts.push({
                id: 'unfilled-beds',
                severity: 'warning',
                message: `${board.unfilledBedIds.length} unfilled bed${board.unfilledBedIds.length === 1 ? '' : 's'} on ${board.unitName}`,
            });
        }
    }

    if (openShiftCount > 0) {
        alerts.push({
            id: 'open-shifts',
            severity: 'warning',
            message: `${openShiftCount} open shift${openShiftCount === 1 ? '' : 's'} today`,
            actionLabel: 'View open shifts',
        });
    }

    const availableFloat = floatPool.filter((n) => n.available);
    if (availableFloat.length > 0) {
        alerts.push({
            id: 'float-available',
            severity: 'info',
            message: `${availableFloat.length} float nurse${availableFloat.length === 1 ? '' : 's'} available`,
            actionLabel: 'Assign float',
        });
    }

    return alerts;
}

export function careModelFromWard(
    wardId: string,
    wardNames: Record<string, string>,
    wardCodes: Record<string, string>
): UnitCareModel {
    return resolveUnitCareModel({
        code: wardCodes[wardId],
        name: wardNames[wardId],
    });
}

export function moveBedBetweenNurses(
    board: StaffingAssignmentBoard,
    bedId: string,
    fromNurseId: string,
    toNurseId: string
): StaffingAssignmentBoard | null {
    if (fromNurseId === toNurseId) return null;

    const source = board.nurses.find((n) => n.nurseId === fromNurseId);
    const target = board.nurses.find((n) => n.nurseId === toNurseId);
    if (!source || !target) return null;

    const bed = source.assignedBeds.find((b) => b.bedId === bedId);
    if (!bed) return null;

    const nurses = board.nurses.map((n) => {
        if (n.nurseId === fromNurseId) {
            return recomputeNurseRow(
                { ...n, assignedBeds: n.assignedBeds.filter((b) => b.bedId !== bedId) },
                board.unitCareModel
            );
        }
        if (n.nurseId === toNurseId) {
            return recomputeNurseRow({ ...n, assignedBeds: [...n.assignedBeds, bed] }, board.unitCareModel);
        }
        return n;
    });

    return recomputeBoard({ ...board, nurses });
}
