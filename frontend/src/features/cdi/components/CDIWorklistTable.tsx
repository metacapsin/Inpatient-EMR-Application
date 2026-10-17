import { FileQuestion } from 'lucide-react';
import NewDropdown from '@/components/ui/NewDropdown';
import type { CDIWorklistRecord } from '../types/cdi.types';
import { MOCK_CDI_SPECIALISTS } from '../types/cdi.types';

type Props = {
    rows: CDIWorklistRecord[];
    busy: boolean;
    onCreateQuery: (row: CDIWorklistRecord) => void;
    onAssignSpecialist: (queryId: string, specialist: string) => void;
};

function statusBadgeClass(status: CDIWorklistRecord['queryStatus']): string {
    const map: Record<CDIWorklistRecord['queryStatus'], string> = {
        Open: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
        Answered: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
        Closed: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return map[status];
}

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function CDIWorklistTable({ rows, busy, onCreateQuery, onAssignSpecialist }: Props) {
    const specialistOptions = MOCK_CDI_SPECIALISTS.map((s) => ({ label: s, value: s }));

    return (
        <div className="rounded-lg border border-emr-border/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
                        <tr>
                            <th className="p-2 font-medium">Patient</th>
                            <th className="p-2 font-medium">Attending Physician</th>
                            <th className="p-2 font-medium">LOS</th>
                            <th className="p-2 font-medium">Current DRG</th>
                            <th className="p-2 font-medium">Current DRG Weight</th>
                            <th className="p-2 font-medium">Potential DRG</th>
                            <th className="p-2 font-medium">Revenue Opportunity</th>
                            <th className="p-2 font-medium">Queries Sent</th>
                            <th className="p-2 font-medium">Query Status</th>
                            <th className="p-2 font-medium">Assign CDI Specialist</th>
                            <th className="p-2 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="p-4 text-gray-500 dark:text-gray-400">
                                    No CDI worklist records.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr
                                    key={row.queryId}
                                    className="border-t border-gray-100 dark:border-gray-800"
                                >
                                    <td className="p-2 font-medium text-gray-900 dark:text-white">{row.patientName}</td>
                                    <td className="p-2 text-xs">{row.attendingPhysician}</td>
                                    <td className="p-2 text-xs tabular-nums">{row.los}</td>
                                    <td className="p-2 font-mono text-xs">{row.currentDrg}</td>
                                    <td className="p-2 text-xs tabular-nums">{row.currentDrgWeight.toFixed(2)}</td>
                                    <td className="p-2 font-mono text-xs">{row.potentialDrg || '—'}</td>
                                    <td className="p-2 text-xs tabular-nums text-emerald-700 dark:text-emerald-300">
                                        {formatCurrency(row.revenueOpportunity)}
                                    </td>
                                    <td className="p-2 text-xs tabular-nums">{row.queriesSent}</td>
                                    <td className="p-2">
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(row.queryStatus)}`}
                                        >
                                            {row.queryStatus}
                                        </span>
                                    </td>
                                    <td className="p-2 min-w-[140px]">
                                        <NewDropdown
                                            options={specialistOptions}
                                            value={row.assignCdiSpecialist || ''}
                                            onChange={(v) => onAssignSpecialist(row.queryId, String(v))}
                                            placeholder="Assign…"
                                            disabled={busy}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => onCreateQuery(row)}
                                            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                                        >
                                            <FileQuestion className="h-3 w-3" aria-hidden />
                                            Query
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
