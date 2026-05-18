import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    RefreshCw,
} from 'lucide-react';
import { addDays, format, isSaturday, isSunday, isToday } from 'date-fns';
import type { FacilityWard } from '../../../types/facility';
import { listShifts, listShiftTypes, listStaff } from '../../../services/staffScheduling.service';
import type { StaffMember, StaffShift, ShiftType } from '../../../types/staffScheduling.types';
import type { ScheduleFilters } from './ScheduleFiltersBar';
import NewDropdown from '../../../components/ui/NewDropdown';
import { SearchInput } from '../../../components/patients/SearchInput';
import {
    avatarHue,
    formatShiftTimeRange,
    formatWeekRangeLabel,
    initialsFromName,
    shiftCardTitle,
    themeForShiftType,
    weekDaysFrom,
    weekStartMonday,
    ymd,
    type CalendarViewMode,
} from '../utils/staffScheduleWeekUtils';

interface StaffScheduleWeekViewProps {
    filters: ScheduleFilters;
    wards: FacilityWard[];
    wardNames: Record<string, string>;
    highlightStaffId: string | null;
    canManage: boolean;
    onChangeFilters: (patch: Partial<ScheduleFilters>) => void;
    onEditShift: (shift: StaffShift) => void;
    onCreateForStaffDay: (staffId: string, day: Date) => void;
    refreshKey: number;
}

const ROLE_OPTIONS = [
    { value: '', label: 'All Roles' },
    { value: 'clinical-staff', label: 'Clinical staff' },
    { value: 'provider', label: 'Provider' },
];

const DEPT_OPTIONS = [
    { value: '', label: 'All Departments' },
    { value: 'nursing', label: 'Nursing' },
    { value: 'physician', label: 'Physician services' },
];

function staffMatchesDept(staff: StaffMember, dept: string): boolean {
    if (!dept) return true;
    if (dept === 'physician') return staff.role === 'provider';
    return staff.role === 'clinical-staff';
}

function staffMatchesWard(staff: StaffMember, wardId: string): boolean {
    if (!wardId) return true;
    return staff.homeWardId === wardId;
}

export function StaffScheduleWeekView({
    filters,
    wards,
    wardNames,
    highlightStaffId,
    canManage,
    onChangeFilters,
    onEditShift,
    onCreateForStaffDay,
    refreshKey,
}: StaffScheduleWeekViewProps) {
    const [weekAnchor, setWeekAnchor] = useState(() => weekStartMonday(new Date()));
    const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
    const [deptFilter, setDeptFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [shifts, setShifts] = useState<StaffShift[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [lastUpdated, setLastUpdated] = useState(() => new Date());

    const weekStart = weekAnchor;
    const weekDays = useMemo(() => weekDaysFrom(weekStart), [weekStart]);
    const visibleDays = viewMode === 'day' ? [weekDays.find((d) => isToday(d)) ?? weekDays[0]] : weekDays;

    const typeMap = useMemo(() => new Map(shiftTypes.map((t) => [t.id, t])), [shiftTypes]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const from = ymd(weekStart);
            const to = ymd(addDays(weekStart, 6));
            const [s, sh, types] = await Promise.all([
                listStaff(filters.role ? (filters.role as StaffMember['role']) : undefined),
                listShifts({
                    wardId: filters.wardId || undefined,
                    role: filters.role ? (filters.role as StaffMember['role']) : undefined,
                    from,
                    to,
                }),
                listShiftTypes(),
            ]);
            setStaff(s);
            setShifts(sh);
            setShiftTypes(types);
            setLastUpdated(new Date());
        } finally {
            setLoading(false);
        }
    }, [weekStart, filters.wardId, filters.role]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const filteredStaff = useMemo(() => {
        const q = filters.staffSearch.trim().toLowerCase();
        return staff
            .filter((s) => staffMatchesDept(s, deptFilter))
            .filter((s) => staffMatchesWard(s, filters.wardId))
            .filter((s) => !q || s.displayName.toLowerCase().includes(q))
            .filter((s) => !highlightStaffId || s.id === highlightStaffId);
    }, [staff, deptFilter, filters.wardId, filters.staffSearch, highlightStaffId]);

    const shiftByStaffDay = useMemo(() => {
        const map = new Map<string, StaffShift>();
        for (const sh of shifts) {
            if (!sh.staffId || sh.status === 'cancelled') continue;
            const day = ymd(new Date(sh.startAt));
            const cellKey = `${sh.staffId}:${day}`;
            if (!map.has(cellKey)) map.set(cellKey, sh);
        }
        return map;
    }, [shifts]);

    const wardOptions = useMemo(
        () => [
            { value: '', label: 'All Wards' },
            ...wards.map((w) => ({ value: String(w.id), label: w.code ?? w.name })),
        ],
        [wards]
    );

    const goToday = () => setWeekAnchor(weekStartMonday(new Date()));
    const goPrev = () => setWeekAnchor((d) => addDays(d, viewMode === 'month' ? -28 : viewMode === 'day' ? -1 : -7));
    const goNext = () => setWeekAnchor((d) => addDays(d, viewMode === 'month' ? 28 : viewMode === 'day' ? 1 : 7));

    const colTemplate =
        viewMode === 'week'
            ? 'grid-cols-[minmax(240px,280px)_repeat(7,minmax(108px,1fr))]'
            : viewMode === 'day'
              ? 'grid-cols-[minmax(240px,280px)_minmax(140px,1fr)]'
              : 'grid-cols-[minmax(240px,280px)_repeat(7,minmax(72px,1fr))]';

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="shrink-0 space-y-3 border-b border-gray-200/50 px-4 py-3 dark:border-white/[0.06] sm:px-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-3">
                        <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[11rem]">
                            <NewDropdown
                                id="schedule-dept"
                                label="Department"
                                options={DEPT_OPTIONS}
                                value={deptFilter}
                                placeholder="All Departments"
                                className="w-full min-w-0"
                                appendMenuToBody
                                onChange={(v) => setDeptFilter(String(v))}
                            />
                        </div>
                        <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[11rem]">
                            <NewDropdown
                                id="schedule-ward"
                                label="Ward"
                                options={wardOptions}
                                value={filters.wardId}
                                placeholder="All Wards"
                                className="w-full min-w-0"
                                appendMenuToBody
                                onChange={(v) => onChangeFilters({ wardId: String(v) })}
                            />
                        </div>
                        <div className="min-w-0 flex-1 md:min-w-[9rem] md:max-w-[11rem]">
                            <NewDropdown
                                id="schedule-role"
                                label="Role"
                                options={ROLE_OPTIONS}
                                value={filters.role}
                                placeholder="All Roles"
                                className="w-full min-w-0"
                                appendMenuToBody
                                onChange={(v) => onChangeFilters({ role: String(v) })}
                            />
                        </div>
                        <div className="min-w-0 flex-1 md:max-w-[220px]">
                            <SearchInput
                                variant="premium"
                                className="w-full min-w-0"
                                value={filters.staffSearch}
                                onChange={(v) => onChangeFilters({ staffSearch: v })}
                                placeholder="Search staff…"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/5"
                            onClick={goPrev}
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="min-w-[168px] text-center text-sm font-semibold text-gray-900 dark:text-white">
                            {formatWeekRangeLabel(weekStart)}
                        </span>
                        <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/5"
                            onClick={goNext}
                            aria-label="Next"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
                            onClick={goToday}
                        >
                            Today
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(['day', 'week', 'month'] as const).map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                                    viewMode === mode
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
                                }`}
                                onClick={() => setViewMode(mode)}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="relative min-h-0 flex-1 overflow-auto">
                {loading ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 dark:bg-black/50">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Loading schedule…</span>
                    </div>
                ) : null}

                <div className={`grid min-w-[900px] ${colTemplate}`}>
                    {/* Header row */}
                    <div className="sticky left-0 z-10 flex items-end border-b border-r border-gray-200/80 bg-gray-50/95 px-3 py-3 dark:border-gray-700/80 dark:bg-gray-900/90">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Staff Members
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{filteredStaff.length} staff members</p>
                        </div>
                    </div>
                    {visibleDays.map((day) => {
                        const sat = isSaturday(day);
                        const sun = isSunday(day);
                        const today = isToday(day);
                        return (
                            <div
                                key={ymd(day)}
                                className={`border-b border-r border-gray-200/80 px-2 py-2.5 text-center dark:border-gray-700/80 ${
                                    today ? 'bg-primary/5 dark:bg-primary/10' : 'bg-gray-50/60 dark:bg-white/[0.02]'
                                }`}
                            >
                                <p
                                    className={`text-[11px] font-bold uppercase ${
                                        sun
                                            ? 'text-red-500'
                                            : sat
                                              ? 'text-sky-600 dark:text-sky-400'
                                              : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    {format(day, 'EEE')}
                                </p>
                                <p
                                    className={`text-sm font-semibold tabular-nums ${
                                        today ? 'text-primary' : 'text-gray-900 dark:text-white'
                                    }`}
                                >
                                    {format(day, 'M/d')}
                                </p>
                            </div>
                        );
                    })}

                    {/* Staff rows */}
                    {filteredStaff.length === 0 ? (
                        <div
                            className="px-4 py-12 text-center text-sm text-gray-500"
                            style={{ gridColumn: '1 / -1' }}
                        >
                            No staff match the current filters.
                        </div>
                    ) : (
                        filteredStaff.map((member) => {
                            const homeWard = member.homeWardId ? wardNames[member.homeWardId] ?? 'Unit' : '—';
                            const dimmed = highlightStaffId && highlightStaffId !== member.id;
                            return (
                                <Fragment key={member.id}>
                                    <div
                                        className={`sticky left-0 z-[5] flex items-center gap-2.5 border-b border-r border-gray-200/80 bg-white px-3 py-3 dark:border-gray-700/80 dark:bg-[#0c0a08] ${
                                            dimmed ? 'opacity-40' : ''
                                        }`}
                                    >
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="On duty" />
                                        <span
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                            style={{ backgroundColor: avatarHue(member.displayName) }}
                                        >
                                            {initialsFromName(member.displayName)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                {member.displayName}
                                            </p>
                                            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{homeWard}</p>
                                            {member.badges?.[0] ? (
                                                <span className="mt-1 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                                                    {member.badges[0]}
                                                </span>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
                                            aria-label="Staff actions"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {visibleDays.map((day) => {
                                        const key = `${member.id}:${ymd(day)}`;
                                        const shift = shiftByStaffDay.get(key);
                                        const dayKey = `${member.id}-${ymd(day)}`;
                                        if (!shift) {
                                            return (
                                                <div
                                                    key={dayKey}
                                                    className={`flex min-h-[88px] items-center justify-center border-b border-r border-gray-100 bg-gray-50/40 dark:border-gray-800/80 dark:bg-white/[0.01] ${
                                                        dimmed ? 'opacity-40' : ''
                                                    }`}
                                                >
                                                    {canManage ? (
                                                        <button
                                                            type="button"
                                                            className="text-xs text-gray-400 hover:text-primary"
                                                            onClick={() => onCreateForStaffDay(member.id, day)}
                                                        >
                                                            <span className="block text-center text-lg leading-none text-gray-300">—</span>
                                                            <span className="mt-0.5 block text-[10px] font-medium">Off</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-center text-lg text-gray-300">—</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        const st = typeMap.get(shift.shiftTypeId);
                                        const theme = themeForShiftType(shift.shiftTypeId);
                                        const wardLabel = wardNames[shift.wardId] ?? shift.wardId;
                                        return (
                                            <div
                                                key={dayKey}
                                                className={`min-h-[88px] border-b border-r border-gray-100 p-1.5 dark:border-gray-800/80 ${
                                                    dimmed ? 'opacity-40' : ''
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    className={`group relative flex h-full w-full flex-col rounded-lg border px-2 py-2 text-left transition hover:shadow-md ${theme.bg} ${theme.border} ${theme.text}`}
                                                    onClick={() => onEditShift(shift)}
                                                >
                                                    <ArrowLeftRight className="absolute right-1.5 top-1.5 h-3.5 w-3.5 opacity-40 group-hover:opacity-70" />
                                                    <span className="pr-4 text-[11px] font-semibold tabular-nums">
                                                        {formatShiftTimeRange(shift, st)}
                                                    </span>
                                                    <span className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight">
                                                        {shiftCardTitle(wardLabel, st)}
                                                    </span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </Fragment>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Legend footer */}
            <div className="flex shrink-0 flex-col gap-3 border-t border-gray-200/50 px-4 py-2.5 text-[11px] dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <span className={`h-2 w-2 rounded-full ${themeForShiftType('st-day').dot}`} />
                        Day Shift (07:00 - 15:00)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <span className={`h-2 w-2 rounded-full ${themeForShiftType('st-evening').dot}`} />
                        Evening Shift (15:00 - 23:00)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <span className={`h-2 w-2 rounded-full ${themeForShiftType('st-night').dot}`} />
                        Night Shift (23:00 - 07:00)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                        Off / Unscheduled
                    </span>
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-gray-500 hover:text-primary dark:text-gray-400"
                    onClick={() => void load()}
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Last updated: {format(lastUpdated, 'MMM d, yyyy hh:mm a')}
                </button>
            </div>
        </div>
    );
}
