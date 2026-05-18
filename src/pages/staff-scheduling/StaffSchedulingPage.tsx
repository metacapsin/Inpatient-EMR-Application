import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CalendarDays, Plus } from 'lucide-react';
import type { IRootState } from '../../store';
import { getWards } from '../../services/rooms.service';
import { getCoverageSummary, listShiftTypes } from '../../services/staffScheduling.service';
import type { CoverageSummary, OpenShiftRow, StaffShift } from '../../types/staffScheduling.types';
import { canManageStaffSchedule, canViewStaffSchedule } from '../../features/staff-scheduling/staffScheduleRole';
import { ScheduleFiltersBar, type ScheduleFilters } from '../../features/staff-scheduling/components/ScheduleFiltersBar';
import { CoverageSummaryChips } from '../../features/staff-scheduling/components/CoverageSummaryChips';
import { StaffScheduleWeekView } from '../../features/staff-scheduling/components/StaffScheduleWeekView';
import { StaffRosterPanel } from '../../features/staff-scheduling/components/StaffRosterPanel';
import { OpenShiftsPanel } from '../../features/staff-scheduling/components/OpenShiftsPanel';
import { ShiftFormModal, type ShiftFormDefaults } from '../../features/staff-scheduling/components/ShiftFormModal';

type TabId = 'calendar' | 'roster' | 'open-shifts';

const tabBtnBase =
    'inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold transition';
const tabBtnInactive =
    'border border-transparent text-gray-600 hover:bg-gray-100/80 dark:text-gray-400 dark:hover:bg-white/[0.04]';
const tabBtnActive = 'bg-primary text-white shadow-sm';

function defaultRange(): { start: string; end: string } {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const to = new Date(now);
    to.setDate(to.getDate() + 14);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(from), end: fmt(to) };
}

function parseTab(raw: string | null): TabId {
    if (raw === 'roster' || raw === 'open-shifts') return raw;
    return 'calendar';
}

export default function StaffSchedulingPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const role = useSelector((s: IRootState) => s.auth.role);
    const user = useSelector((s: IRootState) => s.auth.user);

    const canView = canViewStaffSchedule(role, user);
    const canManage = canManageStaffSchedule(role, user);

    const tab = parseTab(searchParams.get('tab'));
    const range = defaultRange();

    const [filters, setFilters] = useState<ScheduleFilters>(() => ({
        wardId: searchParams.get('wardId')?.trim() ?? '',
        role: '',
        staffSearch: '',
        rangeStart: range.start,
        rangeEnd: range.end,
    }));

    const [wards, setWards] = useState<Awaited<ReturnType<typeof getWards>>>([]);
    const [summary, setSummary] = useState<CoverageSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [highlightStaffId, setHighlightStaffId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<StaffShift | null>(null);
    const [formDefaults, setFormDefaults] = useState<ShiftFormDefaults | undefined>();

    useEffect(() => {
        void getWards().then(setWards);
    }, []);

    const wardNames = useMemo(() => {
        const m: Record<string, string> = {};
        wards.forEach((w) => {
            m[String(w.id)] = w.name;
        });
        return m;
    }, [wards]);

    useEffect(() => {
        setSummaryLoading(true);
        const today = new Date().toISOString().slice(0, 10);
        void getCoverageSummary({ wardId: filters.wardId || undefined, date: today, wardNames })
            .then(setSummary)
            .finally(() => setSummaryLoading(false));
    }, [filters.wardId, wardNames, refreshKey]);

    const setTab = useCallback(
        (next: TabId) => {
            setSearchParams(
                (prev) => {
                    const p = new URLSearchParams(prev);
                    p.set('tab', next);
                    return p;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const patchFilters = useCallback(
        (patch: Partial<ScheduleFilters>) => {
            setFilters((f) => ({ ...f, ...patch }));
            if (patch.wardId !== undefined) {
                setSearchParams(
                    (prev) => {
                        const p = new URLSearchParams(prev);
                        if (patch.wardId) p.set('wardId', patch.wardId);
                        else p.delete('wardId');
                        return p;
                    },
                    { replace: true }
                );
            }
        },
        [setSearchParams]
    );

    const bumpRefresh = () => setRefreshKey((k) => k + 1);

    const openCreate = (defaults?: ShiftFormDefaults) => {
        setEditingShift(null);
        setFormDefaults(defaults);
        setModalOpen(true);
    };

    const openEdit = (shift: StaffShift) => {
        setEditingShift(shift);
        setFormDefaults(undefined);
        setModalOpen(true);
    };

    const openCreateForStaffDay = useCallback(
        async (staffId: string, day: Date) => {
            const types = await listShiftTypes();
            const st = types.find((t) => t.id === 'st-day') ?? types[0];
            if (!st) {
                openCreate({ staffId });
                return;
            }
            const start = new Date(day);
            const [sh, sm] = st.startTime.split(':').map(Number);
            const [eh, em] = st.endTime.split(':').map(Number);
            start.setHours(sh, sm, 0, 0);
            const end = new Date(start);
            if (eh < sh || (eh === sh && em <= sm)) end.setDate(end.getDate() + 1);
            end.setHours(eh, em, 0, 0);
            openCreate({
                staffId,
                wardId: filters.wardId || undefined,
                shiftTypeId: st.id,
                startAt: start.toISOString(),
                endAt: end.toISOString(),
            });
        },
        [filters.wardId]
    );

    if (!canView) {
        return (
            <div className="panel p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">You do not have access to staff scheduling.</p>
            </div>
        );
    }

    return (
        <div className="font-inter relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-[#141210] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.45)]">
            <div className="shrink-0 space-y-3 p-4 sm:p-5 sm:pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                            <CalendarDays className="h-4 w-4" aria-hidden />
                        </div>
                        <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
                            Staff scheduling
                        </h1>
                    </div>
                    {canManage ? (
                        <button
                            type="button"
                            onClick={() => openCreate()}
                            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 sm:self-auto"
                        >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Add shift
                        </button>
                    ) : null}
                </div>

                <CoverageSummaryChips summary={summary} loading={summaryLoading} compact />

                <div className="flex flex-wrap gap-1 border-t border-gray-200/50 pt-3 dark:border-white/[0.06]">
                    {(
                        [
                            ['calendar', 'Calendar'],
                            ['roster', 'Roster'],
                            ['open-shifts', 'Open shifts'],
                        ] as const
                    ).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            className={`${tabBtnBase} ${tab === id ? tabBtnActive : tabBtnInactive}`}
                            onClick={() => setTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab !== 'calendar' ? (
                    <div className="border-t border-gray-200/50 pt-3 dark:border-white/[0.06]">
                        <ScheduleFiltersBar filters={filters} wards={wards} onChange={patchFilters} />
                    </div>
                ) : null}
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-gray-200/50 dark:border-white/[0.06]">
                {tab === 'calendar' ? (
                    <StaffScheduleWeekView
                        filters={filters}
                        wards={wards}
                        wardNames={wardNames}
                        highlightStaffId={highlightStaffId}
                        canManage={canManage}
                        onChangeFilters={patchFilters}
                        onEditShift={openEdit}
                        onCreateForStaffDay={(staffId, day) => void openCreateForStaffDay(staffId, day)}
                        refreshKey={refreshKey}
                    />
                ) : null}

                {tab === 'roster' ? (
                    <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
                        <StaffRosterPanel
                            filters={filters}
                            highlightStaffId={highlightStaffId}
                            canManage={canManage}
                            onHighlightStaff={setHighlightStaffId}
                            onAddShiftForStaff={(staffId) => openCreate({ staffId, wardId: filters.wardId || undefined })}
                        />
                    </div>
                ) : null}

                {tab === 'open-shifts' ? (
                    <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
                        <OpenShiftsPanel
                            filters={filters}
                            wardNames={wardNames}
                            canManage={canManage}
                            refreshKey={refreshKey}
                            onAssign={(row: OpenShiftRow) => {
                                if (row.shift.id.startsWith('gap-')) {
                                    openCreate({
                                        wardId: row.shift.wardId,
                                        shiftTypeId: row.shift.shiftTypeId,
                                    });
                                } else {
                                    openEdit(row.shift);
                                }
                            }}
                        />
                    </div>
                ) : null}
            </div>

            <ShiftFormModal
                open={modalOpen}
                shift={editingShift}
                wards={wards}
                canManage={canManage}
                defaults={formDefaults}
                onClose={() => setModalOpen(false)}
                onSaved={bumpRefresh}
            />
        </div>
    );
}
