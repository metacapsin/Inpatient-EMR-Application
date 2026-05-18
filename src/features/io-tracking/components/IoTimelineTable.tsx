import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import { AppModal } from '../../../components/shared/AppModal';
import { TablePagination } from '../../../components/shared/TablePagination';
import type { IoAddIntakePayload, IoAddOutputPayload, IoTimelineRow } from '../types/ioRecord.types';
import { IoIntakeEntryForm } from './IoIntakeEntryForm';
import { IoOutputEntryForm } from './IoOutputEntryForm';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

/** Rows-only vertical scroll; header and pagination stay outside this band. */
const TIMELINE_ROWS_SCROLL_CLASS =
    'min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain scroll-smooth [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]';

const NOTES_COLLAPSED_MAX = 72;

const TABLE_LAYOUT_CLASS = 'min-w-full w-full table-fixed border-collapse';

const TH_CLASS =
    'px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-50 dark:bg-[#1a1816] dark:text-gray-400';

const TD_CLASS = 'px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200';

function TimelineColGroup() {
    return (
        <colgroup>
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[33%]" />
            <col className="w-[20%]" />
        </colgroup>
    );
}

function TimelineNotesCell({ notes }: { notes: string }) {
    const [expanded, setExpanded] = useState(false);
    const text = notes.trim();

    if (!text) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    const needsToggle = text.length > NOTES_COLLAPSED_MAX || /\n/.test(text);

    if (!needsToggle) {
        return <span className="whitespace-pre-wrap break-words">{text}</span>;
    }

    return (
        <div className="max-w-full min-w-0">
            <p className={`whitespace-pre-wrap break-words leading-snug ${expanded ? '' : 'line-clamp-2'}`}>{text}</p>
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 text-[10px] font-semibold text-primary hover:text-primary-600 hover:underline dark:hover:text-primary-200"
                aria-expanded={expanded}
            >
                {expanded ? 'See less' : 'See more'}
            </button>
        </div>
    );
}

const CARD_CLASS =
    'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#141210]';

function formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function rowMatchesQuery(row: IoTimelineRow, query: string): boolean {
    const haystack = [
        formatTime(row.timeIso),
        row.recordType,
        row.category,
        String(row.volumeMl),
        row.notes,
        row.recordedByName,
    ]
        .join(' ')
        .toLowerCase();
    return haystack.includes(query);
}

export type IoTimelineTableProps = {
    rows: IoTimelineRow[];
    loading?: boolean;
    disabled?: boolean;
    patientId: string;
    encounterId: string;
    tenantId: string;
    recordedBy: string;
    recordedByName: string;
    shift?: string;
    onAddRecord: (payload: IoAddIntakePayload | IoAddOutputPayload) => Promise<void>;
};

export function IoTimelineTable({
    rows,
    loading,
    disabled,
    patientId,
    encounterId,
    tenantId,
    recordedBy,
    recordedByName,
    shift,
    onAddRecord,
}: IoTimelineTableProps) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [intakeOpen, setIntakeOpen] = useState(false);
    const [outputOpen, setOutputOpen] = useState(false);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) => rowMatchesQuery(row, q));
    }, [rows, search]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

    useEffect(() => {
        setPage(1);
    }, [search, rows]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const paginatedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [filteredRows, page, pageSize]);

    const entryProps = {
        patientId,
        encounterId,
        tenantId,
        recordedBy,
        recordedByName,
        shift,
        disabled,
    };

    return (
        <>
            <section className={CARD_CLASS} aria-labelledby="io-timeline-heading">
                <div className="z-[2] shrink-0 border-b border-gray-200/80 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-[#141210]">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h4
                            id="io-timeline-heading"
                            className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            Chronological timeline
                        </h4>
                        <div className="relative min-w-0 flex-1 sm:max-w-xs">
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                                aria-hidden
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search timeline…"
                                disabled={loading}
                                className="h-8 w-full rounded-lg border border-gray-200/90 bg-white py-0 pl-8 pr-2.5 text-xs font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary/15 disabled:opacity-60 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600"
                                aria-label="Search chronological timeline"
                            />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <AppButton
                                type="button"
                                className="!h-8 !px-3 !py-0 !text-xs"
                                disabled={disabled}
                                onClick={() => setIntakeOpen(true)}
                            >
                                Add intake
                            </AppButton>
                            <AppButton
                                type="button"
                                className="!h-8 !px-3 !py-0 !text-xs"
                                disabled={disabled}
                                onClick={() => setOutputOpen(true)}
                            >
                                Add output
                            </AppButton>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-1 items-center justify-center gap-2 px-4 py-10" role="status">
                        <Loader2 className="h-5 w-5 animate-spin text-primary/80" aria-hidden />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Loading records…</span>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <p className="flex flex-1 items-center justify-center px-4 py-10 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                        {rows.length === 0
                            ? 'No I&O entries yet. Use Add intake or Add output to document.'
                            : 'No records match your search.'}
                    </p>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="z-[1] shrink-0 overflow-x-auto border-b border-gray-200/80 bg-gray-50 dark:border-white/10 dark:bg-[#1a1816]">
                            <table className={TABLE_LAYOUT_CLASS}>
                                <TimelineColGroup />
                                <thead>
                                    <tr>
                                        <th scope="col" className={TH_CLASS}>
                                            Time
                                        </th>
                                        <th scope="col" className={TH_CLASS}>
                                            Record type
                                        </th>
                                        <th scope="col" className={TH_CLASS}>
                                            Category
                                        </th>
                                        <th scope="col" className={TH_CLASS}>
                                            Volume
                                        </th>
                                        <th scope="col" className={TH_CLASS}>
                                            Notes
                                        </th>
                                        <th scope="col" className={TH_CLASS}>
                                            Recorded by
                                        </th>
                                    </tr>
                                </thead>
                            </table>
                        </div>

                        <div
                            className={TIMELINE_ROWS_SCROLL_CLASS}
                            role="region"
                            aria-label="Chronological timeline entries"
                            tabIndex={0}
                        >
                            <table className={TABLE_LAYOUT_CLASS}>
                                <TimelineColGroup />
                                <tbody className="divide-y divide-gray-100 bg-white dark:divide-white/5 dark:bg-[#141210]">
                                    {paginatedRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.02]"
                                        >
                                            <td className={`${TD_CLASS} whitespace-nowrap tabular-nums`}>
                                                {formatTime(row.timeIso)}
                                            </td>
                                            <td className={TD_CLASS}>
                                                <span
                                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                        row.recordType === 'Intake'
                                                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                                                            : 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                                                    }`}
                                                >
                                                    {row.recordType}
                                                </span>
                                            </td>
                                            <td className={`${TD_CLASS} truncate`} title={row.category}>
                                                {row.category}
                                            </td>
                                            <td className={`${TD_CLASS} tabular-nums whitespace-nowrap`}>
                                                {row.volumeMl.toLocaleString()} mL
                                            </td>
                                            <td className={`${TD_CLASS} align-top`}>
                                                <TimelineNotesCell notes={row.notes} />
                                            </td>
                                            <td className={`${TD_CLASS} truncate`} title={row.recordedByName}>
                                                {row.recordedByName}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <TablePagination
                            page={page}
                            pageSize={pageSize}
                            totalItems={filteredRows.length}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                            loading={loading}
                            itemLabel="entries"
                            onPageChange={setPage}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                        />
                    </div>
                )}
            </section>

            <AppModal
                open={intakeOpen}
                title="Intake entry"
                onClose={() => setIntakeOpen(false)}
                size="lg"
                className="max-w-3xl"
            >
                <IoIntakeEntryForm
                    {...entryProps}
                    variant="embedded"
                    onSaved={() => setIntakeOpen(false)}
                    onSubmit={onAddRecord}
                />
            </AppModal>

            <AppModal
                open={outputOpen}
                title="Output entry"
                onClose={() => setOutputOpen(false)}
                size="lg"
                className="max-w-3xl"
            >
                <IoOutputEntryForm
                    {...entryProps}
                    variant="embedded"
                    onSaved={() => setOutputOpen(false)}
                    onSubmit={onAddRecord}
                />
            </AppModal>
        </>
    );
}
