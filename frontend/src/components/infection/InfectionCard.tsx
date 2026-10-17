import { format, isValid, parseISO } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import type { InfectionRecord } from '../../types/infectionControl';
import { InfectionIsolationBadge, InfectionStatusBadge } from './InfectionBadge';
import { recordRequiresIsolation, severityBadgeClass } from '../../lib/infectionControlUtils';

type InfectionCardProps = {
    record: InfectionRecord;
    onEdit: (record: InfectionRecord) => void;
    onDelete: (id: string) => void;
};

function formatDate(iso: string): string {
    try {
        const d = parseISO(iso);
        if (!isValid(d)) return iso;
        return format(d, 'MMM d, yyyy');
    } catch {
        return iso;
    }
}

export function InfectionCard({ record, onEdit, onDelete }: InfectionCardProps) {
    const showIsolation = recordRequiresIsolation(record);

    return (
        <article className="rounded-lg border border-gray-200/70 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#1a1a1a]">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{record.infectionType}</h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Detected {formatDate(record.detectedDate)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <InfectionStatusBadge status={record.status} />
                    <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityBadgeClass(record.severity)}`}
                    >
                        {record.severity}
                    </span>
                </div>
            </div>

            {showIsolation ? (
                <div className="mt-3">
                    <InfectionIsolationBadge />
                    {record.isolationType && record.isolationType !== 'None' ? (
                        <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                            Isolation type: <span className="font-semibold">{record.isolationType}</span>
                        </p>
                    ) : null}
                </div>
            ) : null}

            <dl className="mt-3 grid gap-2 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
                {record.symptoms ? (
                    <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Symptoms</dt>
                        <dd className="mt-0.5">{record.symptoms}</dd>
                    </div>
                ) : null}
                {record.source ? (
                    <div>
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Source</dt>
                        <dd className="mt-0.5">{record.source}</dd>
                    </div>
                ) : null}
                {record.notes ? (
                    <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap">{record.notes}</dd>
                    </div>
                ) : null}
            </dl>

            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                <button
                    type="button"
                    onClick={() => onEdit(record)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(record.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200/80 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                </button>
            </div>
        </article>
    );
}
