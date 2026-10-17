import type { ReactNode } from 'react';
import { PatientMobileCard, PatientTableRow } from './PatientRow';
import { SortableHeader } from './SortableHeader';
import type { PatientListItem, PatientListSortField } from '../../services/patient.service';
import type { AdtWorkflowIntent } from '../adt/AdtPatientWorkflowModal';

interface PatientTableProps {
    patients: PatientListItem[];
    loading: boolean;
    sortBy: PatientListSortField;
    sortOrder: 'asc' | 'desc';
    onSort: (field: PatientListSortField) => void;
    sortDisabled?: boolean;
    /** From GET /api/admissions/active; same source as the bed board active encounters list. */
    serverActivePatientIds?: ReadonlySet<string>;
    /** patientId → encounterId for discharge readiness deep-linking */
    activeEncounterIdByPatientId?: ReadonlyMap<string, string>;
    onOpenAdt?: (patient: PatientListItem, intent: AdtWorkflowIntent) => void;
}

/** Column hints for `table-fixed` so the grid fits the viewport without horizontal scroll. */
function PatientTableColGroup() {
    const widths = ['22%', '10%', '5%', '9%', '16%', '14%', '12%', '12%'] as const;
    return (
        <colgroup>
            {widths.map((w, i) => (
                <col key={i} style={{ width: w }} />
            ))}
        </colgroup>
    );
}

const theadClassName =
    'sticky top-0 z-10 border-b border-gray-200/80 bg-gray-50/90 text-[10px] font-bold uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#1c1c1c]/95 dark:text-gray-400';

function TableSkeleton() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                    <td className="px-2.5 py-2" colSpan={8}>
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="h-2.5 max-w-[40%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                <div className="h-2 max-w-[55%] animate-pulse rounded bg-gray-100 dark:bg-gray-600" />
                            </div>
                        </div>
                    </td>
                </tr>
            ))}
        </>
    );
}

function sortHandler(
    sortDisabled: boolean | undefined,
    onSort: (field: PatientListSortField) => void,
    field: PatientListSortField
) {
    if (sortDisabled) return;
    onSort(field);
}

function DesktopTableCard({ children }: { children: ReactNode }) {
    return (
        <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#1a1a1a] dark:shadow-none md:flex md:min-h-[16rem] md:flex-1">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain">{children}</div>
        </div>
    );
}

const PatientTable = ({
    patients,
    loading,
    sortBy,
    sortOrder,
    onSort,
    sortDisabled,
    serverActivePatientIds,
    activeEncounterIdByPatientId,
    onOpenAdt,
}: PatientTableProps) => {
    const handleSort = (field: PatientListSortField) => sortHandler(sortDisabled, onSort, field);

    const headerProps = (key: PatientListSortField) => ({
        sortKey: key,
        activeSortKey: sortBy,
        sortOrder,
        onSort: handleSort,
        disabled: sortDisabled,
    });

    const headerRow = (
        <tr>
            <SortableHeader isSortable={false}>Patient</SortableHeader>
            <SortableHeader {...headerProps('dob')}>DOB / Age</SortableHeader>
            <SortableHeader {...headerProps('gender')}>Gender</SortableHeader>
            <SortableHeader {...headerProps('status')}>Status</SortableHeader>
            <SortableHeader isSortable={false}>Inpatient</SortableHeader>
            <SortableHeader {...headerProps('phone')}>Phone</SortableHeader>
            <SortableHeader {...headerProps('createdDate')}>Created Date</SortableHeader>
            <SortableHeader isSortable={false} align="right">
                Actions
            </SortableHeader>
        </tr>
    );

    const tableShell = (body: ReactNode) => (
        <table className="w-full min-w-[720px] table-fixed text-left text-xs">
            <PatientTableColGroup />
            <thead className={theadClassName}>{headerRow}</thead>
            <tbody className="divide-y divide-gray-100/90 dark:divide-white/[0.05]">{body}</tbody>
        </table>
    );

    if (loading) {
        return (
            <>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:hidden">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pe-1">
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
                            ))}
                        </div>
                    </div>
                </div>
                <DesktopTableCard>{tableShell(<TableSkeleton />)}</DesktopTableCard>
            </>
        );
    }

    if (patients.length === 0) {
        return (
            <>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:hidden">
                    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pe-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No patients found.</p>
                    </div>
                </div>
                <DesktopTableCard>
                    {tableShell(
                        <tr>
                            <td colSpan={8} className="px-2.5 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                                No patients found.
                            </td>
                        </tr>
                    )}
                </DesktopTableCard>
            </>
        );
    }

    return (
        <>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:hidden">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pe-1">
                    {patients.map((p) => (
                        <PatientMobileCard
                            key={p.id}
                            patient={p}
                            serverActivePatientIds={serverActivePatientIds}
                            activeEncounterIdByPatientId={activeEncounterIdByPatientId}
                            onOpenAdt={onOpenAdt}
                        />
                    ))}
                </div>
            </div>
            <DesktopTableCard>
                {tableShell(
                    patients.map((p) => (
                        <PatientTableRow
                            key={p.id}
                            patient={p}
                            serverActivePatientIds={serverActivePatientIds}
                            activeEncounterIdByPatientId={activeEncounterIdByPatientId}
                            onOpenAdt={onOpenAdt}
                        />
                    ))
                )}
            </DesktopTableCard>
        </>
    );
};

export default PatientTable;
