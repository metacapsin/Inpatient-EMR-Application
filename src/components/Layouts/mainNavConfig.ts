/** Same routes/labels as the main app sidebar — no extra items. */
export const APPOINTMENT_SUB_LINKS = [
    { to: '/app/appointments', label: 'Appointments list' },
    { to: '/app/appointments/calendar', label: 'Calendar view' },
] as const;

const APPOINTMENT_ACTIVE_PREFIX = '/app/appointments';

export function isAppointmentsSectionActive(pathname: string): boolean {
    return pathname === APPOINTMENT_ACTIVE_PREFIX || pathname.startsWith(`${APPOINTMENT_ACTIVE_PREFIX}/`);
}

export const PATIENT_SUB_LINKS = [
    { to: '/app/patients/list', label: 'Patient List' },
    { to: '/app/bed-board', label: 'Bed board' },
    {
        to: '/app/inpatient/clinical',
        label: 'Clinical workspace',
        title: 'Physician & nursing notes, vitals, order entry',
    },
    {
        to: '/app/inpatient/orders',
        label: 'Orders dashboard',
        title: 'Unified monitoring across medication, lab, radiology, dietary, therapy, and procedure orders',
    },
    {
        to: '/app/inpatient/medication-management',
        label: 'Medication management',
        title: 'MAR, PRN/STAT, pharmacy dispensing, discharge medications',
    },
    {
        to: '/app/inpatient/care-plan',
        label: 'Care Plan',
        title: 'Structured NANDA diagnoses, goals, and interdisciplinary interventions',
    },
    {
        to: '/app/inpatient/discharge-readiness',
        label: 'Discharge readiness',
        title: 'Discharge summary, checklist, charges, eligibility, claim prep',
    },
] as const;

const PATIENT_ACTIVE_PREFIXES = ['/app/patients', '/app/bed-board', '/app/inpatient'] as const;

export function isPatientsSectionActive(pathname: string): boolean {
    return PATIENT_ACTIVE_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}
