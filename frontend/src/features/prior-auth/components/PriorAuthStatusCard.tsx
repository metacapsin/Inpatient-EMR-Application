import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { PriorAuthRecord } from '../types/priorAuth.types';
import { daysUntilEnd, expiryAlertTone, formatAuthPeriod } from '../Prior/priorAuthDates';

function priorAuthSearchHaystack(row: PriorAuthRecord): string {
    return [
        row.serviceType,
        row.serviceDescription,
        row.payerName,
        row.insurancePayer,
        row.authNumber,
        row.status,
        ...row.icd10Codes,
        ...row.cptCodes,
        formatAuthPeriod(row.authStartDate, row.authEndDate),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

type Props = {
    rows: PriorAuthRecord[];
    busy: boolean;
    onCreate: () => void;
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

export function PriorAuthStatusCard({ rows, busy, onCreate, onEdit, onPeerToPeer, onMarkReceived }: Props) {
    const [search, setSearch] = useState('');

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) => priorAuthSearchHaystack(row).includes(q));
    }, [rows, search]);

    return (
        <section className="rounded-lg border border-emr-border/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
            <div className="flex flex-wrap items-center gap-2 border-b border-emr-border/80 px-4 py-3 dark:border-white/10 sm:gap-3">
                <h3 className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">PA Status</h3>
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                        aria-hidden
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search prior auth…"
                        disabled={busy}
                        className="h-8 w-full rounded-lg border border-gray-200/90 bg-white py-0 pl-8 pr-2.5 text-xs font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary/15 disabled:opacity-60 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600"
                        aria-label="Search prior authorizations"
                    />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button type="button" size="sm" disabled={busy} onClick={onCreate}>
                        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Create Prior Auth
                    </Button>
                </div>
            </div>

            {rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    No prior authorization records for this encounter. Use Create Prior Auth to add one.
                </p>
            ) : filteredRows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    No prior authorizations match your search.
                </p>
            ) : (
                <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
                    {filteredRows.map((row) => {
                        const days = daysUntilEnd(row.authEndDate);
                        const unitsLeft = Math.max(0, row.approvedUnits - row.usedUnits);
                        const alert = expiryLabel(row);
                        return (
                            <li
                                key={row.authId}
                                className="rounded-lg border border-gray-200/90 bg-gray-50/50 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900 dark:text-white">{row.serviceType}</p>
                                        {row.serviceDescription ? (
                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {row.serviceDescription}
                                            </p>
                                        ) : null}
                                    </div>
                                    <span
                                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                                    >
                                        {row.status}
                                    </span>
                                </div>

                                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <div>
                                        <dt className="text-gray-500 dark:text-gray-400">Payer</dt>
                                        <dd className="font-medium text-gray-800 dark:text-gray-200">
                                            {row.payerName || row.insurancePayer || '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500 dark:text-gray-400">Auth Number</dt>
                                        <dd className="font-mono font-medium text-gray-800 dark:text-gray-200">
                                            {row.authNumber || '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500 dark:text-gray-400">Auth Period</dt>
                                        <dd className="text-gray-800 dark:text-gray-200">
                                            {formatAuthPeriod(row.authStartDate, row.authEndDate)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500 dark:text-gray-400">Days / Units Remaining</dt>
                                        <dd className="text-gray-800 dark:text-gray-200">
                                            {days !== null ? `${days}d` : '—'} / {unitsLeft} units
                                        </dd>
                                    </div>
                                    {alert ? (
                                        <div className="col-span-2">
                                            <dt className="text-gray-500 dark:text-gray-400">Expiry Alert</dt>
                                            <dd className={alert.className}>{alert.text}</dd>
                                        </div>
                                    ) : null}
                                    {row.urgentFlag ? (
                                        <div className="col-span-2">
                                            <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                                                Urgent
                                            </span>
                                        </div>
                                    ) : null}
                                </dl>

                                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-200/80 pt-3 dark:border-white/10">
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
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
