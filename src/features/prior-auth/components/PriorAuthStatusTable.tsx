import { Button } from '../../../components/ui/button';
import type { PriorAuthRecord } from '../types/priorAuth.types';
import { daysUntilEnd, expiryAlertTone, formatAuthPeriod } from '../utils/priorAuthDates';
type Props = {
    rows: PriorAuthRecord[];
    busy: boolean;
    onEdit: (row: PriorAuthRecord) => void;
    onPeerToPeer: (row: PriorAuthRecord) => void;
    onMarkReceived: (row: PriorAuthRecord) => void;
};

function statusBadgeClass(status: PriorAuthRecord['status']): string {
    const map: Record<string, string> = {
        Approved: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
        Pending: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
        Submitted: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
        Denied: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
        Expired: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        'Not Started': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        'Peer-to-Peer Requested': 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100',
    };
    return map[status] ?? map['Not Started'];
}

function expiryLabel(row: PriorAuthRecord): { text: string; className: string } | null {
    const tone = expiryAlertTone(row.authEndDate, row.status);
    if (tone === 'none') return null;
    const days = daysUntilEnd(row.authEndDate);
    const text = days !== null && days < 1 ? 'Expires in < 1 day' : 'Expiring in < 3 days';
    const className =
        tone === 'red'
            ? 'text-red-700 font-semibold dark:text-red-300'
            : 'text-orange-700 font-semibold dark:text-orange-300';
    return { text, className };
}

export function PriorAuthStatusTable({ rows, busy, onEdit, onPeerToPeer, onMarkReceived }: Props) {
    return (
        <div className="rounded-lg border border-emr-border/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
            <div className="border-b border-emr-border/80 px-4 py-3 dark:border-white/10">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">PA Status</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
                        <tr>
                            <th className="p-2 font-medium">Service</th>
                            <th className="p-2 font-medium">Payer</th>
                            <th className="p-2 font-medium">Auth Number</th>
                            <th className="p-2 font-medium">Status</th>
                            <th className="p-2 font-medium">Auth Period</th>
                            <th className="p-2 font-medium">Days / Units Remaining</th>
                            <th className="p-2 font-medium">Expiry Alert</th>
                            <th className="p-2 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-4 text-gray-500 dark:text-gray-400">
                                    No prior authorization records for this encounter.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => {
                                const days = daysUntilEnd(row.authEndDate);
                                const unitsLeft = Math.max(0, row.approvedUnits - row.usedUnits);
                                const alert = expiryLabel(row);
                                return (
                                    <tr
                                        key={row.authId}
                                        className="border-t border-gray-100 dark:border-gray-800"
                                    >
                                        <td className="p-2">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {row.serviceType}
                                            </span>
                                            {row.serviceDescription ? (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {row.serviceDescription}
                                                </p>
                                            ) : null}
                                        </td>
                                        <td className="p-2">{row.payerName || row.insurancePayer}</td>
                                        <td className="p-2 font-mono text-xs">{row.authNumber || '—'}</td>
                                        <td className="p-2">
                                            <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                                            >
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="p-2 whitespace-nowrap text-xs">
                                            {formatAuthPeriod(row.authStartDate, row.authEndDate)}
                                        </td>
                                        <td className="p-2 text-xs">
                                            {days !== null ? `${days}d` : '—'} / {unitsLeft} units
                                        </td>
                                        <td className="p-2 text-xs">
                                            {alert ? <span className={alert.className}>{alert.text}</span> : '—'}
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-wrap gap-1">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={() => onEdit(row)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={() => onPeerToPeer(row)}
                                                >
                                                    Request Peer-to-Peer
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={() => onMarkReceived(row)}
                                                >
                                                    Mark Received
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
