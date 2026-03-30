import { PatientMobileCard, PatientTableRow } from './PatientRow';
import { SortableHeader } from './SortableHeader';
import type { PatientListItem, PatientListSortField } from '../../services/patient.service';

interface PatientTableProps {
    patients: PatientListItem[];
    loading: boolean;
    sortBy: PatientListSortField;
    sortOrder: 'asc' | 'desc';
    onSort: (field: PatientListSortField) => void;
    sortDisabled?: boolean;
}

function TableSkeleton() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                    <td className="px-4 py-3" colSpan={6}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                <div className="h-2.5 w-56 animate-pulse rounded bg-gray-100 dark:bg-gray-600" />
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

const PatientTable = ({
    patients,
    loading,
    sortBy,
    sortOrder,
    onSort,
    sortDisabled,
}: PatientTableProps) => {
    const handleSort = (field: PatientListSortField) => sortHandler(sortDisabled, onSort, field);

    const headerProps = (key: PatientListSortField) => ({
        sortKey: key,
        activeSortKey: sortBy,
        sortOrder,
        onSort: handleSort,
        disabled: sortDisabled,
    });

    if (loading) {
        return (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#1a1a1a]">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/80">
                            <tr>
                                <SortableHeader {...headerProps('patient')}>Patient</SortableHeader>
                                <SortableHeader {...headerProps('dob')}>DOB</SortableHeader>
                                <SortableHeader {...headerProps('gender')}>Gender</SortableHeader>
                                <SortableHeader {...headerProps('phone')}>Phone</SortableHeader>
                                <SortableHeader {...headerProps('createdDate')}>Created Date</SortableHeader>
                                <SortableHeader isSortable={false} align="right">
                                    Actions
                                </SortableHeader>
                            </tr>
                        </thead>
                        <tbody>
                            <TableSkeleton />
                        </tbody>
                    </table>
                </div>
                <div className="space-y-3 p-4 md:hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                    ))}
                </div>
            </div>
        );
    }

    if (patients.length === 0) {
        return (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center dark:border-gray-600 dark:bg-gray-800/30">
                <p className="text-lg font-medium text-gray-800 dark:text-gray-100">No patients found</p>
                <p className="mt-1 max-w-sm text-sm text-gray-600 dark:text-gray-400">
                    Try adjusting search or filters.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#1a1a1a] md:block">
                <div className="max-h-[min(70vh,720px)] overflow-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/80">
                            <tr>
                                <SortableHeader {...headerProps('patient')}>Patient</SortableHeader>
                                <SortableHeader {...headerProps('dob')}>DOB</SortableHeader>
                                <SortableHeader {...headerProps('gender')}>Gender</SortableHeader>
                                <SortableHeader {...headerProps('phone')}>Phone</SortableHeader>
                                <SortableHeader {...headerProps('createdDate')}>Created Date</SortableHeader>
                                <SortableHeader isSortable={false} align="right" className="text-gray-500">
                                    Actions
                                </SortableHeader>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {patients.map((p) => (
                                <PatientTableRow key={p.id} patient={p} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-3 md:hidden">
                {patients.map((p) => (
                    <PatientMobileCard key={p.id} patient={p} />
                ))}
            </div>
        </>
    );
};

export default PatientTable;
