/**
 * Staff scheduling — mock implementation with documented REST contract for backend work.
 *
 * -----------------------------------------------------------------------------
 * Future REST integration
 * -----------------------------------------------------------------------------
 *
 *   GET    /api/inpatient/staff-scheduling/shifts?wardId=&staffId=&from=&to=
 *   GET    /api/inpatient/staff-scheduling/shifts/:id
 *   POST   /api/inpatient/staff-scheduling/shifts
 *   PUT    /api/inpatient/staff-scheduling/shifts/:id
 *   DELETE /api/inpatient/staff-scheduling/shifts/:id
 *   GET    /api/inpatient/staff-scheduling/staff?role=
 *   GET    /api/inpatient/staff-scheduling/shift-types
 *   GET    /api/inpatient/staff-scheduling/open-shifts?wardId=&from=&to=
 *   GET    /api/inpatient/staff-scheduling/me/shifts?wardId=&date=
 */

import type {
    CoverageRule,
    CoverageSummary,
    OpenShiftRow,
    StaffClinicalRole,
    StaffMember,
    StaffShift,
    StaffShiftFilters,
    StaffShiftInput,
    ShiftType,
} from '../types/staffScheduling.types';

function useMock(): boolean {
    return import.meta.env.VITE_STAFF_SCHEDULING_MOCK !== 'false';
}

function mockDelay<T>(value: T, ms = 120): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let nextId = 1000;
function genId(prefix: string): string {
    nextId += 1;
    return `${prefix}-${nextId}`;
}

const SHIFT_TYPES: ShiftType[] = [
    { id: 'st-day', label: 'Day (7a–7p)', startTime: '07:00', endTime: '19:00', color: '#4361ee' },
    { id: 'st-evening', label: 'Evening (3p–11p)', startTime: '15:00', endTime: '23:00', color: '#f59e0b' },
    { id: 'st-night', label: 'Night (7p–7a)', startTime: '19:00', endTime: '07:00', color: '#8b5cf6' },
];

const STAFF: StaffMember[] = [
    { id: 'staff-1', displayName: 'Jordan Lee, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '1', badges: ['ICU Certified'] },
    { id: 'staff-2', displayName: 'Sam Patel, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '1', badges: ['ICU Certified'] },
    { id: 'staff-3', displayName: 'Alex Kim, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '2' },
    { id: 'staff-4', displayName: 'Morgan Chen, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '2' },
    { id: 'staff-5', displayName: 'Taylor Brooks, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '3' },
    { id: 'staff-6', displayName: 'Dr. Riley Hart', role: 'provider', credentials: 'MD', active: true, homeWardId: '1' },
    { id: 'staff-7', displayName: 'Dr. Casey Nguyen', role: 'provider', credentials: 'MD', active: true, homeWardId: '2' },
    { id: 'staff-8', displayName: 'Jamie Ortiz, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '1', badges: ['ICU Certified'] },
    { id: 'staff-9', displayName: 'Chris Davis, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '3' },
    { id: 'staff-10', displayName: 'Pat Rivera, RN', role: 'clinical-staff', credentials: 'RN', active: true, homeWardId: '2' },
];

const COVERAGE_RULES: CoverageRule[] = [
    { wardId: '1', shiftTypeId: 'st-day', minStaff: 3, role: 'clinical-staff' },
    { wardId: '1', shiftTypeId: 'st-night', minStaff: 2, role: 'clinical-staff' },
    { wardId: '2', shiftTypeId: 'st-day', minStaff: 4, role: 'clinical-staff' },
    { wardId: '2', shiftTypeId: 'st-night', minStaff: 3, role: 'clinical-staff' },
    { wardId: '3', shiftTypeId: 'st-day', minStaff: 3, role: 'clinical-staff' },
    { wardId: '3', shiftTypeId: 'st-evening', minStaff: 2, role: 'clinical-staff' },
];

let shifts: StaffShift[] = [];

function shiftTypeById(id: string): ShiftType | undefined {
    return SHIFT_TYPES.find((t) => t.id === id);
}

function staffById(id: string | null | undefined): StaffMember | undefined {
    if (!id) return undefined;
    return STAFF.find((s) => s.id === id);
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

function buildShiftAt(
    dayOffset: number,
    shiftTypeId: string,
    wardId: string,
    staffId: string | null,
    status: StaffShift['status'] = 'scheduled'
): StaffShift {
    const st = shiftTypeById(shiftTypeId)!;
    const base = startOfDay(addDays(new Date(), dayOffset));
    const [sh, sm] = st.startTime.split(':').map(Number);
    const [eh, em] = st.endTime.split(':').map(Number);
    const start = new Date(base);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(base);
    if (eh < sh || (eh === sh && em <= sm)) {
        end.setDate(end.getDate() + 1);
    }
    end.setHours(eh, em, 0, 0);
    return {
        id: genId('shift'),
        staffId,
        wardId,
        shiftTypeId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        status,
        notes: status === 'open' ? 'Coverage needed' : undefined,
    };
}

function seedShifts(): void {
    if (shifts.length > 0) return;
    const roster = ['staff-1', 'staff-2', 'staff-3', 'staff-4', 'staff-5', 'staff-8', 'staff-9'];
    const wards = ['1', '2', '3'];
    const types = ['st-day', 'st-evening', 'st-night'] as const;
    for (let d = -3; d <= 10; d++) {
        wards.forEach((wardId, wi) => {
            types.forEach((typeId, ti) => {
                const staffId = roster[(d + wi + ti) % roster.length] ?? 'staff-1';
                if (d === 0 && wardId === '1' && typeId === 'st-night' && wi === 0) {
                    shifts.push(buildShiftAt(d, typeId, wardId, null, 'open'));
                } else if (d === 1 && wardId === '2' && typeId === 'st-day') {
                    shifts.push(buildShiftAt(d, typeId, wardId, null, 'open'));
                } else {
                    shifts.push(buildShiftAt(d, typeId, wardId, staffId, 'scheduled'));
                }
            });
        });
    }
    shifts.push(buildShiftAt(0, 'st-day', '1', 'staff-1', 'scheduled'));
}

function inRange(iso: string, from?: string, to?: string): boolean {
    const t = new Date(iso).getTime();
    if (from) {
        const f = new Date(from).getTime();
        if (t < f) return false;
    }
    if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (t > end.getTime()) return false;
    }
    return true;
}

function applyFilters(list: StaffShift[], filters?: StaffShiftFilters): StaffShift[] {
    if (!filters) return list;
    return list.filter((s) => {
        if (filters.wardId && s.wardId !== filters.wardId) return false;
        if (filters.staffId && s.staffId !== filters.staffId) return false;
        if (filters.status && s.status !== filters.status) return false;
        if (filters.from || filters.to) {
            if (!inRange(s.startAt, filters.from, filters.to)) return false;
        }
        if (filters.role) {
            const member = staffById(s.staffId);
            if (s.status === 'open') return filters.role === 'clinical-staff';
            if (!member || member.role !== filters.role) return false;
        }
        return true;
    });
}

/** Map shift type label to nursing flowsheet `shiftType` field values. */
export function flowsheetShiftLabelForType(shiftTypeId: string): string {
    const st = shiftTypeById(shiftTypeId);
    return st?.label ?? 'Day (7a–7p)';
}

export function formatShiftOptionLabel(shift: StaffShift, wardName: string): string {
    const st = shiftTypeById(shift.shiftTypeId);
    const start = new Date(shift.startAt);
    const end = new Date(shift.endAt);
    const time =
        start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) +
        ' – ' +
        end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${st?.label ?? 'Shift'} · ${wardName} · ${time}`;
}

export async function listShiftTypes(): Promise<ShiftType[]> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    return mockDelay([...SHIFT_TYPES]);
}

export async function listStaff(role?: StaffClinicalRole): Promise<StaffMember[]> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    let list = STAFF.filter((s) => s.active);
    if (role) list = list.filter((s) => s.role === role);
    return mockDelay(list.sort((a, b) => a.displayName.localeCompare(b.displayName)));
}

export async function listShifts(filters?: StaffShiftFilters): Promise<StaffShift[]> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    return mockDelay(applyFilters([...shifts], filters));
}

export async function getShift(id: string): Promise<StaffShift | null> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    return mockDelay(shifts.find((s) => s.id === id) ?? null);
}

export async function createShift(input: StaffShiftInput): Promise<StaffShift> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    const row: StaffShift = { id: genId('shift'), ...input };
    shifts = [...shifts, row];
    return mockDelay(row);
}

export async function updateShift(id: string, input: Partial<StaffShiftInput>): Promise<StaffShift> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    const idx = shifts.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error('Shift not found');
    const next = { ...shifts[idx], ...input, id };
    shifts = shifts.map((s, i) => (i === idx ? next : s));
    return mockDelay(next);
}

export async function deleteShift(id: string): Promise<void> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    shifts = shifts.filter((s) => s.id !== id);
    return mockDelay(undefined);
}

function countScheduled(
    wardId: string,
    shiftTypeId: string,
    role: StaffClinicalRole,
    dayStart: Date,
    dayEnd: Date
): number {
    return shifts.filter((s) => {
        if (s.wardId !== wardId || s.shiftTypeId !== shiftTypeId || s.status === 'cancelled') return false;
        if (s.status === 'open' || !s.staffId) return false;
        const member = staffById(s.staffId);
        if (!member || member.role !== role) return false;
        const t = new Date(s.startAt).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
    }).length;
}

export async function listOpenShifts(opts?: {
    wardId?: string;
    from?: string;
    to?: string;
    wardNames?: Record<string, string>;
}): Promise<OpenShiftRow[]> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    const names = opts?.wardNames ?? {};
    const rows: OpenShiftRow[] = [];

    const openAssigned = shifts.filter((s) => {
        if (s.status !== 'open' && s.staffId !== null) return false;
        if (s.status === 'cancelled') return false;
        if (s.status === 'open' || !s.staffId) {
            if (opts?.wardId && s.wardId !== opts.wardId) return false;
            if (opts?.from || opts?.to) {
                if (!inRange(s.startAt, opts.from, opts.to)) return false;
            }
            return true;
        }
        return false;
    });

    for (const s of openAssigned) {
        const st = shiftTypeById(s.shiftTypeId);
        rows.push({
            shift: s,
            wardName: names[s.wardId] ?? `Ward ${s.wardId}`,
            shiftTypeLabel: st?.label ?? s.shiftTypeId,
            reason: 'unassigned',
            requiredRole: 'clinical-staff',
        });
    }

    const day = opts?.from ? new Date(opts.from) : new Date();
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    for (const rule of COVERAGE_RULES) {
        if (opts?.wardId && rule.wardId !== opts.wardId) continue;
        const scheduled = countScheduled(rule.wardId, rule.shiftTypeId, rule.role, dayStart, dayEnd);
        if (scheduled < rule.minStaff) {
            const st = shiftTypeById(rule.shiftTypeId);
            const existing = rows.some(
                (r) => r.wardName === (names[rule.wardId] ?? '') && r.shiftTypeLabel === (st?.label ?? '')
            );
            if (!existing) {
                rows.push({
                    shift: {
                        id: `gap-${rule.wardId}-${rule.shiftTypeId}`,
                        staffId: null,
                        wardId: rule.wardId,
                        shiftTypeId: rule.shiftTypeId,
                        startAt: dayStart.toISOString(),
                        endAt: dayEnd.toISOString(),
                        status: 'open',
                    },
                    wardName: names[rule.wardId] ?? `Ward ${rule.wardId}`,
                    shiftTypeLabel: st?.label ?? rule.shiftTypeId,
                    reason: 'understaffed',
                    requiredRole: rule.role,
                });
            }
        }
    }

    return mockDelay(rows);
}

export async function getCoverageSummary(opts?: {
    wardId?: string;
    date?: string;
    wardNames?: Record<string, string>;
}): Promise<CoverageSummary> {
    const date = opts?.date ?? new Date().toISOString().slice(0, 10);
    const open = await listOpenShifts({ wardId: opts?.wardId, from: date, to: date, wardNames: opts?.wardNames });
    return {
        openShiftCount: open.filter((r) => r.reason === 'unassigned').length,
        understaffedWards: open
            .filter((r) => r.reason === 'understaffed')
            .map((r) => ({
                wardId: r.shift.wardId,
                wardName: r.wardName,
                shiftTypeLabel: r.shiftTypeLabel,
            })),
    };
}

/**
 * Shifts for the signed-in user on a ward for a given calendar day (flowsheet shift switcher).
 * Matches `staffId` to `userId`; demo fallback uses first clinical-staff on ward when no match.
 */
export async function getMyShiftsForWard(userId: string, wardId: string, dateYmd: string): Promise<StaffShift[]> {
    if (!useMock()) throw new Error('Staff scheduling API not configured');
    seedShifts();
    const dayStart = startOfDay(new Date(dateYmd + 'T12:00:00'));
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    let mine = shifts.filter((s) => {
        if (s.wardId !== wardId || s.status === 'cancelled') return false;
        const t = new Date(s.startAt).getTime();
        if (t < dayStart.getTime() || t > dayEnd.getTime()) return false;
        return s.staffId === userId;
    });

    if (mine.length === 0) {
        const linked =
            STAFF.find((s) => s.id === userId) ??
            STAFF.find((s) => s.displayName.toLowerCase().includes(String(userId).toLowerCase()));
        const staffId = linked?.id ?? 'staff-1';
        mine = shifts.filter((s) => {
            if (s.wardId !== wardId || s.status !== 'scheduled' || s.staffId !== staffId) return false;
            const t = new Date(s.startAt).getTime();
            return t >= dayStart.getTime() && t <= dayEnd.getTime();
        });
    }

    return mockDelay(mine.sort((a, b) => a.startAt.localeCompare(b.startAt)));
}

/** Resets in-memory mock (session testing only). */
export function resetStaffSchedulingMock(): void {
    shifts = [];
    nextId = 1000;
}
