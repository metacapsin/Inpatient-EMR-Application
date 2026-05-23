/** Unit care model drives nurse-to-patient ratio thresholds. */
export type UnitCareModel = 'ICU' | 'Step-Down' | 'Med-Surg' | 'L&D';

export type StaffingRatioStatus = 'safe' | 'warning' | 'critical';

export type NurseClinicalRole = 'RN' | 'LVN' | 'CNA';

export type StaffingCertification = 'ACLS' | 'BLS' | 'TNCC' | 'CCRN';

export type PatientAcuity = 'low' | 'medium' | 'high';

export interface AssignedBedChip {
    bedId: string;
    roomBedLabel: string;
    patientId: string;
    patientInitials: string;
    acuity: PatientAcuity;
    isolation?: boolean;
}

export interface NurseAssignmentRow {
    /** Row id used by PUT /api/Staffing/assignment/:assignmentId */
    id: string;
    nurseId: string;
    displayName: string;
    role: NurseClinicalRole;
    assignedBeds: AssignedBedChip[];
    patientCount: number;
    ratioStatus: StaffingRatioStatus;
    hoursWorkedToday: number;
    isFloatPool: boolean;
    certifications: StaffingCertification[];
    isChargeNurse?: boolean;
}

export interface StaffingAssignmentBoard {
    assignmentId: string;
    unitId: string;
    unitName: string;
    unitCareModel: UnitCareModel;
    date: string;
    /** API shift token, e.g. day | evening | night */
    shift: string;
    shiftLabel: string;
    chargeNurseId: string | null;
    nurses: NurseAssignmentRow[];
    unfilledBedIds: string[];
    totalPatients: number;
}

export interface StaffingKpiSnapshot {
    totalPatients: number;
    totalNurses: number;
    averageRatio: number;
    overtimeStaffCount: number;
    unfilledBeds: number;
}

export type StaffingAlertSeverity = 'critical' | 'warning' | 'info';

export interface StaffingAlertItem {
    id: string;
    severity: StaffingAlertSeverity;
    message: string;
    actionLabel?: string;
}

export interface FloatPoolNurse {
    id: string;
    displayName: string;
    role: NurseClinicalRole;
    certifications: StaffingCertification[];
    homeUnitName?: string;
    available: boolean;
}

export interface RatioCheckResult {
    unitId: string;
    unitCareModel: UnitCareModel;
    averageRatio: number;
    status: StaffingRatioStatus;
    criticalNurses: { nurseId: string; displayName: string; patientCount: number }[];
    understaffed: boolean;
}

export interface CreateStaffingAssignmentPayload {
    unitId: string;
    date: string;
    shift: string;
    chargeNurseId?: string | null;
}

export interface UpdateStaffingAssignmentPayload {
    chargeNurseId?: string | null;
    nurseAssignments: {
        nurseAssignmentId: string;
        assignedBedIds: string[];
    }[];
}
