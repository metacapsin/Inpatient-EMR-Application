/** Clinical role token aligned with `clinicalRole.ts` normalization. */
export type StaffClinicalRole = 'clinical-staff' | 'provider' | 'non-clinical-staff' | 'admin' | 'super-admin';

export interface StaffMember {
    id: string;
    displayName: string;
    role: StaffClinicalRole;
    credentials?: string;
    active: boolean;
    /** Primary unit for roster display (ward id). */
    homeWardId?: string;
    /** e.g. ICU Certified */
    badges?: string[];
}

export interface ShiftType {
    id: string;
    label: string;
    /** HH:mm local display anchor for seeding */
    startTime: string;
    endTime: string;
    color: string;
}

export type StaffShiftStatus = 'scheduled' | 'open' | 'cancelled';

export interface StaffShift {
    id: string;
    staffId: string | null;
    wardId: string;
    shiftTypeId: string;
    startAt: string;
    endAt: string;
    status: StaffShiftStatus;
    notes?: string;
}

export interface CoverageRule {
    wardId: string;
    shiftTypeId: string;
    minStaff: number;
    role: StaffClinicalRole;
}

export interface StaffShiftFilters {
    wardId?: string;
    staffId?: string;
    role?: StaffClinicalRole;
    from?: string;
    to?: string;
    status?: StaffShiftStatus;
}

export interface OpenShiftRow {
    shift: StaffShift;
    wardName: string;
    shiftTypeLabel: string;
    reason: 'unassigned' | 'understaffed';
    requiredRole: StaffClinicalRole;
}

export interface CoverageSummary {
    openShiftCount: number;
    understaffedWards: { wardId: string; wardName: string; shiftTypeLabel: string }[];
}

export interface StaffShiftInput {
    staffId: string | null;
    wardId: string;
    shiftTypeId: string;
    startAt: string;
    endAt: string;
    status: StaffShiftStatus;
    notes?: string;
}
