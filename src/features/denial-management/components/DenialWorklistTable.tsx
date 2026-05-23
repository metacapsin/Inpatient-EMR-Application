import { Eye, FilePen, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { ClaimDenialRecord, DenialStatus } from '../types/denial.types';
import { AppealDeadlineBadge } from './AppealDeadlineBadge';

type Props = {
    rows: ClaimDenialRecord[];
    busy: boolean;
    onView: (row: ClaimDenialRecord) => void;
    onAppeal: (row: ClaimDenialRecord) => void;
    onUpdateStatus: (row: ClaimDenialRecord) => void;
};

function statusBadgeClass(status: DenialStatus): string {
    const map: Record<DenialStatus, string> = {
        New: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
        Working: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
        Appealed: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100',
        Resolved: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
        'Written Off': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return map[status];
}

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function DenialWorklistTable({ rows, busy, onView, onAppeal, onUpdateStatus }: Props) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    return (
        <div className="rounded-lg border border-emr-border/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
                        <tr>
                            <th className="p-2 font-medium">Claim #</th>
                            <th className="p-2 font-medium">Patient</th>
                            <th className="p-2 font-medium">Date of Service</th>
                            <th className="p-2 font-medium">Payer</th>
                            <th className="p-2 font-medium">Billed Amount</th>
                            <th className="p-2 font-medium">Denied Amount</th>
                            <th className="p-2 font-medium">Denial Code</th>
                            <th className="p-2 font-medium">Denial Reason</th>
                            <th className="p-2 font-medium">Category</th>
                            <th className="p-2 font-medium">Appeal Deadline</th>
                            <th className="p-2 font-medium">Status</th>
                            <th className="p-2 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="p-4 text-gray-500 dark:text-gray-400">
                                    No denials on worklist.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr
                                    key={row.denialId}
                                    className="border-t border-gray-100 dark:border-gray-800"
                                >
                                    <td className="p-2 font-mono text-xs">{row.claimNumber}</td>
                                    <td className="p-2 font-medium text-gray-900 dark:text-white">{row.patientName}</td>
                                    <td className="p-2 whitespace-nowrap text-xs">{row.dateOfService}</td>
                                    <td className="p-2 text-xs">{row.payer}</td>
                                    <td className="p-2 text-xs tabular-nums">{formatCurrency(row.billedAmount)}</td>
                                    <td className="p-2 text-xs tabular-nums text-red-700 dark:text-red-300">
                                        {formatCurrency(row.deniedAmount)}
                                    </td>
                                    <td className="p-2 font-mono text-xs">{row.denialCode}</td>
                                    <td className="p-2 max-w-[180px] text-xs text-gray-600 dark:text-gray-400">
                                        {row.denialReason}
                                    </td>
                                    <td className="p-2 text-xs">{row.category}</td>
                                    <td className="p-2">
                                        <AppealDeadlineBadge appealDeadline={row.appealDeadline} />
                                    </td>
                                    <td className="p-2">
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="p-2">
                                        <div className="relative flex flex-wrap gap-1">
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => onView(row)}
                                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.04]"
                                            >
                                                <Eye className="h-3 w-3" aria-hidden />
                                                View
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => onAppeal(row)}
                                                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50 dark:border-primary/40"
                                            >
                                                <FilePen className="h-3 w-3" aria-hidden />
                                                Appeal
                                            </button>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        setOpenMenuId((id) => (id === row.denialId ? null : row.denialId))
                                                    }
                                                    className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-200"
                                                    aria-label="More actions"
                                                >
                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                </button>
                                                {openMenuId === row.denialId ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="fixed inset-0 z-10"
                                                            aria-label="Close menu"
                                                            onClick={() => setOpenMenuId(null)}
                                                        />
                                                        <div className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#1a1816]">
                                                            <button
                                                                type="button"
                                                                className="block w-full px-3 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.04]"
                                                                onClick={() => {
                                                                    setOpenMenuId(null);
                                                                    onUpdateStatus(row);
                                                                }}
                                                            >
                                                                Update Status
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
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
