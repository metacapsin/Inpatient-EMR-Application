/** Links under Facility Management (settings only — operational workflows live under Operations nav). */
export const FACILITY_MANAGEMENT_LINKS = [
    {
        to: '/app/settings/facility',
        label: 'Wards, rooms & beds',
        title: 'Configure facility structure',
    },
] as const;

const FACILITY_PREFIXES = ['/app/settings/facility'] as const;

export function isFacilityManagementActive(pathname: string): boolean {
    return FACILITY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
