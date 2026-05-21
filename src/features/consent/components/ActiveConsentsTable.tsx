import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, FilePenLine, ShieldOff } from 'lucide-react';
import { TablePagination } from '../../../components/shared/TablePagination';
import { cn } from '../../../lib/utils';
import type { ConsentRecord, ConsentStatus, ConsentType } from '../../../types/consent';
import { ALL_CONSENT_TYPES, CONSENT_STATUSES } from '../constants/consentOptions';
import { facesheetNotesPath } from '../utils/consentLinks';
import { ConsentStatusBadge } from './ConsentStatusBadge';
import { CONSENT_SECTION_CARD_CLASS } from '../constants/consentLayout';
import { ConsentDropdown, ConsentTextInput, toConsentSelectOptions } from './ConsentStyledFields';

type SortKey = 'consentType' | 'status' | 'signedAt' | 'expiryDate';
type SortDir = 'asc' | 'desc';

type Props = {
    records: ConsentRecord[];
    patientId: string;
    onViewPdf: (record: ConsentRecord) => void;
    onReObtain: (record: ConsentRecord) => void;
    onRevoke: (record: ConsentRecord) => void;
};

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    } catch {
        return iso;
    }
}

export function ActiveConsentsTable({ records, patientId, onViewPdf, onReObtain, onRevoke }: Props) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<ConsentStatus | ''>('');
    const [typeFilter, setTypeFilter] = useState<ConsentType | ''>('');
    const [sortKey, setSortKey] = useState<SortKey>('signedAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = [...records];
        if (q) {
            rows = rows.filter(
                (r) =>
                    r.consentType.toLowerCase().includes(q) ||
                    (r.procedureName?.toLowerCase().includes(q) ?? false) ||
                    (r.signedByName?.toLowerCase().includes(q) ?? false) ||
                    (r.witnessName?.toLowerCase().includes(q) ?? false),
            );
        }
        if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
        if (typeFilter) rows = rows.filter((r) => r.consentType === typeFilter);

        rows.sort((a, b) => {
            const av = a[sortKey] ?? '';
            const bv = b[sortKey] ?? '';
            const cmp = String(av).localeCompare(String(bv));
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return rows;
    }, [records, search, statusFilter, typeFilter, sortKey, sortDir]);

    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const thClass =
        'cursor-pointer select-none px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200';

    const statusOptions = [{ label: 'All statuses', value: '' }, ...toConsentSelectOptions(CONSENT_STATUSES)];
    const typeOptions = [{ label: 'All types', value: '' }, ...toConsentSelectOptions(ALL_CONSENT_TYPES)];

    return (
        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${CONSENT_SECTION_CARD_CLASS}`}>
            <div className="flex shrink-0 flex-wrap items-end gap-2.5 border-b border-gray-200/90 px-3 py-3 dark:border-white/10">
                <div className="min-w-[200px] flex-1">
                    <ConsentTextInput
                        fieldId="consent-search"
                        label="Search"
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            setPage(1);
                        }}
                        placeholder="Type, signer, witness…"
                    />
                </div>
                <div className="w-full min-w-[140px] sm:w-40">
                    <ConsentDropdown
                        fieldId="consent-filter-status"
                        label="Status"
                        options={statusOptions}
                        value={statusFilter}
                        onChange={(v) => {
                            setStatusFilter(String(v) as ConsentStatus | '');
                            setPage(1);
                        }}
                    />
                </div>
                <div className="w-full min-w-[160px] sm:w-48">
                    <ConsentDropdown
                        fieldId="consent-filter-type"
                        label="Consent type"
                        options={typeOptions}
                        value={typeFilter}
                        onChange={(v) => {
                            setTypeFilter(String(v) as ConsentType | '');
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="sticky top-0 z-[2] border-b border-gray-200 bg-gray-50/95 backdrop-blur dark:border-white/10 dark:bg-gray-900/95">
                        <tr>
                            <th scope="col" className={thClass} onClick={() => toggleSort('consentType')}>
                                Consent Type
                            </th>
                            <th scope="col" className={thClass} onClick={() => toggleSort('status')}>
                                Status
                            </th>
                            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Signed By
                            </th>
                            <th scope="col" className={thClass} onClick={() => toggleSort('signedAt')}>
                                Signed Date
                            </th>
                            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Witness
                            </th>
                            <th scope="col" className={thClass} onClick={() => toggleSort('expiryDate')}>
                                Expiry
                            </th>
                            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Language
                            </th>
                            <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {pageRows.map((row) => (
                            <tr
                                key={row.consentId}
                                className="transition-colors hover:bg-primary/[0.03] dark:hover:bg-primary/5"
                            >
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{row.consentType}</div>
                                    {row.procedureName ? (
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                            <span>{row.procedureName}</span>
                                            {row.linkedProcedureNoteId ? (
                                                <Link
                                                    to={facesheetNotesPath(patientId, row.linkedProcedureNoteId)}
                                                    className="font-medium text-primary hover:underline"
                                                >
                                                    Procedure note
                                                </Link>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3">
                                    <ConsentStatusBadge status={row.status} />
                                </td>
                                <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                                    <div>{row.signedByName || '—'}</div>
                                    {row.signedByType !== 'Patient' && row.signedByRelationship ? (
                                        <div className="text-[11px] text-gray-500">{row.signedByRelationship}</div>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(row.signedAt)}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.witnessName || '—'}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(row.expiryDate)}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.languageUsed || '—'}</td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onViewPdf(row)}
                                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                                        >
                                            <Eye className="h-3 w-3" aria-hidden />
                                            View PDF
                                        </button>
                                        {(row.status === 'Signed' || row.status === 'Expired' || row.status === 'Revoked') && (
                                            <button
                                                type="button"
                                                onClick={() => onReObtain(row)}
                                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                                            >
                                                <FilePenLine className="h-3 w-3" aria-hidden />
                                                Re-obtain
                                            </button>
                                        )}
                                        {row.status === 'Signed' && (
                                            <button
                                                type="button"
                                                onClick={() => onRevoke(row)}
                                                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                                            >
                                                <ShieldOff className="h-3 w-3" aria-hidden />
                                                Revoke
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No consents match your filters.</p>
                ) : null}
            </div>

            <TablePagination
                page={page}
                pageSize={pageSize}
                totalItems={filtered.length}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                }}
                itemLabel="consents"
            />
        </div>
    );
}
