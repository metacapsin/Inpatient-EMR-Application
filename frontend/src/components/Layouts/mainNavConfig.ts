/** Enterprise main navigation — scalable grouped structure for inpatient EMR workflows. */
import type { ModuleKey } from '../../hooks/useTenantModules';

export interface MainNavLink {
    readonly to: string;
    readonly label: string;
    readonly title?: string;
    /** When true, NavLink uses `end` (exact path match for active state). */
    readonly end?: boolean;
    /** Tenant module that gates this link (see useTenantModules.ts). Omit for always-on links. */
    readonly module?: ModuleKey;
}

export interface MainNavDropdownGroup {
    readonly id: string;
    readonly label: string;
    readonly items: readonly MainNavLink[];
    readonly activePrefixes: readonly string[];
    /** Align flyout to the trigger's trailing edge when near the global search field. */
    readonly menuAlign?: 'start' | 'end';
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
    { to: '/app/patients/list', label: 'Patient List', module: 'patients' },
    { to: '/app/patients/register', label: 'Register Patient', module: 'patients' },
    { to: '/app/bed-board', label: 'Bed Board', module: 'adt' },
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
        module: 'patients',
    },
    {
        to: '/app/inpatient/orders',
        label: 'Orders Dashboard',
        title: 'Unified monitoring across medication, lab, radiology, dietary, therapy, and procedure orders',
        module: 'medication',
    },
    {
        to: '/app/inpatient/medication-management',
        label: 'Medication Management',
        title: 'MAR, PRN/STAT, pharmacy dispensing, discharge medications',
        module: 'medication',
    },
    {
        to: '/app/inpatient/discharge-readiness',
        label: 'Discharge Readiness',
        title: 'Discharge summary, checklist, charges, eligibility, claim prep',
        module: 'adt',
    },
    {
        to: '/app/quality/infection-dashboard',
        label: 'Infection Analytics',
        title: 'HAI event summary and unit infection quality metrics',
        module: 'patients',
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
        module: 'staffing',
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

/** Revenue cycle — prior auth, denials, CDI. */
export const BILLING_SUB_LINKS: readonly MainNavLink[] = [
    // {
    //     to: '/app/inpatient/discharge-readiness',
    //     label: 'Prior Auth',
    //     title: 'Discharge readiness eligibility and prior authorization',
    // },
    {
        to: '/app/billing/denials',
        label: 'Denials',
        title: 'Denial management worklist and appeals',
        module: 'billing',
    },
    {
        to: '/app/billing/cdi',
        label: 'CDI Worklist',
        title: 'Clinical documentation improvement queries',
        module: 'billing',
    },
];

export const BILLING_ACTIVE_PREFIXES = ['/app/billing', '/app/inpatient/discharge-readiness'] as const;

export function isBillingSectionActive(pathname: string): boolean {
    return isSectionActive(pathname, BILLING_ACTIVE_PREFIXES);
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
        menuAlign: 'end',
    },
    {
        id: 'billing',
        label: 'Billing',
        items: BILLING_SUB_LINKS,
        activePrefixes: BILLING_ACTIVE_PREFIXES,
        menuAlign: 'end',
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
