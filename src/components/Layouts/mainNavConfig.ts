/** Enterprise main navigation — scalable grouped structure for inpatient EMR workflows. */

export interface MainNavLink {
    readonly to: string;
    readonly label: string;
    readonly title?: string;
    /** When true, NavLink uses `end` (exact path match for active state). */
    readonly end?: boolean;
}

export interface MainNavDropdownGroup {
    readonly id: string;
    readonly label: string;
    readonly items: readonly MainNavLink[];
    readonly activePrefixes: readonly string[];
}

export const DASHBOARD_LINK: MainNavLink = { to: '/app/dashboard', label: 'Dashboard' };

export const SETTINGS_LINK: MainNavLink = { to: '/app/settings', label: 'Settings' };

export const APPOINTMENT_SUB_LINKS: readonly MainNavLink[] = [
    { to: '/app/appointments', label: 'Appointments list', end: true },
    { to: '/app/appointments/calendar', label: 'Calendar view' },
];

const APPOINTMENT_ACTIVE_PREFIX = '/app/appointments';

export function isAppointmentsSectionActive(pathname: string): boolean {
    return pathname === APPOINTMENT_ACTIVE_PREFIX || pathname.startsWith(`${APPOINTMENT_ACTIVE_PREFIX}/`);
}

/** Patient registry & bed management — stays under Patients. */
export const PATIENT_SUB_LINKS: readonly MainNavLink[] = [
    { to: '/app/patients/list', label: 'Patient List' },
    { to: '/app/bed-board', label: 'Bed Board' },
];

export const PATIENT_ACTIVE_PREFIXES = ['/app/patients', '/app/bed-board'] as const;

export function isPatientsSectionActive(pathname: string): boolean {
    return isSectionActive(pathname, PATIENT_ACTIVE_PREFIXES);
}

/** Clinical inpatient workflows — physician, nursing, orders, quality. */
export const CLINICAL_SUB_LINKS: readonly MainNavLink[] = [
    {
        to: '/app/inpatient/clinical',
        label: 'Clinical Workspace',
        title: 'Physician & nursing notes, vitals, order entry',
    },
    {
        to: '/app/inpatient/orders',
        label: 'Orders Dashboard',
        title: 'Unified monitoring across medication, lab, radiology, dietary, therapy, and procedure orders',
    },
    {
        to: '/app/inpatient/medication-management',
        label: 'Medication Management',
        title: 'MAR, PRN/STAT, pharmacy dispensing, discharge medications',
    },
    {
        to: '/app/inpatient/discharge-readiness',
        label: 'Discharge Readiness',
        title: 'Discharge summary, checklist, charges, eligibility, claim prep',
    },
    {
        to: '/app/quality/infection-dashboard',
        label: 'Infection Analytics',
        title: 'HAI event summary and unit infection quality metrics',
    },
    {
        to: '/app/reports/quality-measures',
        label: 'Quality Measures',
        title: 'Inpatient bundle compliance dashboard (SEP-1, VTE, CAUTI, and related measures)',
    },
];

export const CLINICAL_ACTIVE_PREFIXES = ['/app/inpatient', '/app/quality', '/app/reports'] as const;

export function isClinicalSectionActive(pathname: string): boolean {
    return isSectionActive(pathname, CLINICAL_ACTIVE_PREFIXES);
}

/** Live operational workflows — staffing, EVS, and future modules (transport, monitoring). */
export const OPERATIONS_SUB_LINKS: readonly MainNavLink[] = [
    {
        to: '/app/staff-scheduling',
        label: 'Staffing',
        title: 'Staff scheduling, live assignments, and unit coverage',
    },
    {
        to: '/app/operations/evs-queue',
        label: 'EVS Queue',
        title: 'Environmental services queue and bed cleaning workflow',
    },
];

export const OPERATIONS_ACTIVE_PREFIXES = ['/app/staff-scheduling', '/app/operations'] as const;

export function isOperationsSectionActive(pathname: string): boolean {
    return isSectionActive(pathname, OPERATIONS_ACTIVE_PREFIXES);
}

/** Top-nav dropdown groups (order = display order). Extend items/activePrefixes per module. */
export const MAIN_NAV_DROPDOWN_GROUPS: readonly MainNavDropdownGroup[] = [
    {
        id: 'patients',
        label: 'Patients',
        items: PATIENT_SUB_LINKS,
        activePrefixes: PATIENT_ACTIVE_PREFIXES,
    },
    {
        id: 'clinical',
        label: 'Clinical',
        items: CLINICAL_SUB_LINKS,
        activePrefixes: CLINICAL_ACTIVE_PREFIXES,
    },
    {
        id: 'operations',
        label: 'Operations',
        items: OPERATIONS_SUB_LINKS,
        activePrefixes: OPERATIONS_ACTIVE_PREFIXES,
    },
];

export function matchesNavPrefix(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isSectionActive(pathname: string, prefixes: readonly string[]): boolean {
    return prefixes.some((prefix) => matchesNavPrefix(pathname, prefix));
}

export function isDropdownGroupActive(pathname: string, group: MainNavDropdownGroup): boolean {
    return isSectionActive(pathname, group.activePrefixes);
}
