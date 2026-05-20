/** Links under Facility Management (settings + operations). */
export const FACILITY_MANAGEMENT_LINKS = [
    {
        to: '/app/settings/facility',
        label: 'Wards, rooms & beds',
        title: 'Configure facility structure',
    },
    {
        to: '/app/operations/evs-queue',
        label: 'EVS / bed turnaround',
        title: 'Environmental services queue and bed cleaning workflow',
    },
] as const;

const FACILITY_PREFIXES = ['/app/settings/facility', '/app/operations/evs-queue'] as const;

export function isFacilityManagementActive(pathname: string): boolean {
    return FACILITY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
