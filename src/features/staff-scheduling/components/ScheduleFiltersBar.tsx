import NewDropdown from '../../../components/ui/NewDropdown';
import type { FacilityWard } from '../../../types/facility';

export interface ScheduleFilters {
    wardId: string;
    role: string;
    staffSearch: string;
    rangeStart: string;
    rangeEnd: string;
}

interface ScheduleFiltersBarProps {
    filters: ScheduleFilters;
    wards: FacilityWard[];
    onChange: (patch: Partial<ScheduleFilters>) => void;
}

const ROLE_OPTIONS = [
    { value: '', label: 'All roles' },
    { value: 'clinical-staff', label: 'Clinical staff' },
    { value: 'provider', label: 'Provider' },
];

export function ScheduleFiltersBar({ filters, wards, onChange }: ScheduleFiltersBarProps) {
    const wardOptions = [
        { value: '', label: 'All wards' },
        ...wards.map((w) => ({ value: String(w.id), label: w.code ? `${w.name} (${w.code})` : w.name })),
    ];

    return (
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-3">
            <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                <NewDropdown
                    id="staff-schedule-ward"
                    label="Ward"
                    options={wardOptions}
                    value={filters.wardId}
                    placeholder="All wards"
                    className="w-full min-w-0"
                    appendMenuToBody
                    onChange={(v) => onChange({ wardId: String(v) })}
                />
            </div>
            <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                <NewDropdown
                    id="staff-schedule-role"
                    label="Role"
                    options={ROLE_OPTIONS}
                    value={filters.role}
                    placeholder="All roles"
                    className="w-full min-w-0"
                    appendMenuToBody
                    onChange={(v) => onChange({ role: String(v) })}
                />
            </div>
            <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    From
                </label>
                <input
                    type="date"
                    className="form-input h-8 w-full min-w-0 text-sm"
                    value={filters.rangeStart}
                    onChange={(e) => onChange({ rangeStart: e.target.value })}
                />
            </div>
            <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[14rem]">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    To
                </label>
                <input
                    type="date"
                    className="form-input h-8 w-full min-w-0 text-sm"
                    value={filters.rangeEnd}
                    onChange={(e) => onChange({ rangeEnd: e.target.value })}
                />
            </div>
            <div className="min-w-0 flex-1 md:max-w-[240px]">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Staff search
                </label>
                <input
                    type="search"
                    placeholder="Name…"
                    className="form-input h-8 w-full min-w-0 text-sm"
                    value={filters.staffSearch}
                    onChange={(e) => onChange({ staffSearch: e.target.value })}
                />
            </div>
        </div>
    );
}
