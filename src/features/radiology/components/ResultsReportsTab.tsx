import { useMemo, useState } from 'react';
import type { RadiologyOrder } from '../types/radiologyOrder.types';
import { RADIOLOGY_SECTION_CARD_CLASS } from '../constants/radiologyLayout';
import { formatRadiologyDateTime, resolveOrderId } from '../utils/radiologyMappers';
import { RadiologyEmptyState } from './RadiologyEmptyState';

const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const FIELD_VALUE = 'text-xs font-medium text-gray-900 dark:text-gray-100';

type ResultsReportsTabProps = {
    orders: RadiologyOrder[];
};

function hasResultData(order: RadiologyOrder): boolean {
    return Boolean(
        order.resultedAt ||
            order.performedAt ||
            order.impression?.trim() ||
            order.findings?.trim() ||
            order.radiologistName?.trim()
    );
}

export function ResultsReportsTab({ orders }: ResultsReportsTabProps) {
    const withResults = useMemo(() => orders.filter(hasResultData), [orders]);
    const [selectedId, setSelectedId] = useState('');

    const selected = useMemo(() => {
        if (!withResults.length) return null;
        const id = selectedId || resolveOrderId(withResults[0]);
        return withResults.find((o) => resolveOrderId(o) === id) ?? withResults[0];
    }, [withResults, selectedId]);

    if (!withResults.length) {
        return (
            <RadiologyEmptyState
                title="No resulted studies"
                description="Final, preliminary, and amended reports will appear here once imaging results are filed for this encounter."
            />
        );
    }

    const contact = selected?.radiologistId?.trim()
        ? `ID: ${selected.radiologistId}`
        : '—';

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2 py-1.5 lg:px-3">
            <div className="shrink-0">
                <label className="sr-only" htmlFor="rad-result-select">
                    Select study
                </label>
                <select
                    id="rad-result-select"
                    value={selected ? resolveOrderId(selected) : ''}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="h-9 w-full max-w-md rounded-lg border border-gray-200/80 bg-white px-2 text-xs dark:border-white/10 dark:bg-[#1a1816]"
                >
                    {withResults.map((o) => (
                        <option key={resolveOrderId(o)} value={resolveOrderId(o)}>
                            {o.modality} — {o.bodyRegion} ({formatRadiologyDateTime(o.resultedAt ?? o.performedAt)})
                        </option>
                    ))}
                </select>
            </div>

            {selected ? (
                <article className={`${RADIOLOGY_SECTION_CARD_CLASS} flex-1 overflow-y-auto p-4 [scrollbar-width:thin]`}>
                    <dl className="grid grid-cols-12 gap-x-4 gap-y-4">
                        <div className="col-span-12 md:col-span-6">
                            <dt className={FIELD_LABEL}>Study Date/Time Performed</dt>
                            <dd className={FIELD_VALUE}>{formatRadiologyDateTime(selected.performedAt)}</dd>
                        </div>
                        <div className="col-span-12 md:col-span-6">
                            <dt className={FIELD_LABEL}>Resulted Date/Time</dt>
                            <dd className={FIELD_VALUE}>{formatRadiologyDateTime(selected.resultedAt)}</dd>
                        </div>
                        <div className="col-span-12 md:col-span-6">
                            <dt className={FIELD_LABEL}>Radiologist Name</dt>
                            <dd className={FIELD_VALUE}>{selected.radiologistName?.trim() || '—'}</dd>
                        </div>
                        <div className="col-span-12 md:col-span-6">
                            <dt className={FIELD_LABEL}>Radiologist Contact</dt>
                            <dd className={FIELD_VALUE}>{contact}</dd>
                        </div>
                        <div className="col-span-12">
                            <dt className={FIELD_LABEL}>Impression</dt>
                            <dd className={`${FIELD_VALUE} whitespace-pre-wrap`}>{selected.impression?.trim() || '—'}</dd>
                        </div>
                        <div className="col-span-12">
                            <dt className={FIELD_LABEL}>Findings</dt>
                            <dd className={`${FIELD_VALUE} whitespace-pre-wrap`}>{selected.findings?.trim() || '—'}</dd>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                            <dt className={FIELD_LABEL}>Critical Value Flag</dt>
                            <dd className={FIELD_VALUE}>
                                {selected.criticalValue ? (
                                    <span className="font-bold text-red-700 dark:text-red-300">Critical</span>
                                ) : (
                                    'No'
                                )}
                            </dd>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                            <dt className={FIELD_LABEL}>Critical Value Notified To</dt>
                            <dd className={FIELD_VALUE}>{selected.criticalValueNotifiedTo?.trim() || '—'}</dd>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                            <dt className={FIELD_LABEL}>DICOM Viewer Link</dt>
                            <dd className={FIELD_VALUE}>
                                {selected.dicomViewerUrl?.trim() ? (
                                    <a
                                        href={selected.dicomViewerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        Open viewer
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </dd>
                        </div>
                    </dl>
                </article>
            ) : null}
        </div>
    );
}
