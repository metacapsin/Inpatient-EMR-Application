import { memo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, toast } from '@/lib/utils';
import type { MeasureElement } from '../../types/quality';
import { BUNDLE_COLUMNS, BUNDLE_LABELS } from '../../constants/quality/bundles';
import { QUALITY_STAFF_OPTIONS } from '../../constants/quality/staff';
import { QM_PANEL, QM_STATUS_ICON, QM_STATUS_STYLES } from '../../constants/quality/theme';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { PanelElementSkeleton } from './QualitySkeletons';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import {
    useQualityEncounterDetail,
    useAssignElementTask,
} from '../../hooks/quality/useQualityEncounter';

function formatTs(iso: string | null): string {
    if (!iso) return '—';
    try {
        const d = parseISO(iso);
        if (!isValid(d)) return iso;
        return format(d, 'MMM d, h:mm a');
    } catch {
        return iso;
    }
}

function staffName(id: string | null): string {
    if (!id) return 'Unassigned';
    return QUALITY_STAFF_OPTIONS.find((s) => s.id === id)?.name ?? id;
}

function ElementCard({
    element,
    onAssign,
    assigningId,
}: {
    element: MeasureElement;
    onAssign: (elementId: string, assignTo: string) => Promise<void>;
    assigningId: string | null;
}) {
    const notes = element.notes ?? '';
    const isOverdue = element.status === 'deficient' || Boolean(element.overdueBy);

    return (
        <li
            className={cn(
                'relative rounded-lg border p-4 pl-6',
                isOverdue
                    ? 'border-emr-danger/40 bg-emr-danger/[0.04] dark:border-red-500/30 dark:bg-red-950/20'
                    : 'border-emr-border bg-white dark:border-white/10 dark:bg-[#1a1816]/50',
            )}
        >
            <span
                className="absolute left-2 top-6 bottom-6 w-0.5 rounded-full bg-primary/30"
                aria-hidden
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-emr-text dark:text-white">{element.elementName}</h4>
                <ComplianceStatusBadge status={element.status} />
            </div>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                    <dt className="font-semibold text-emr-muted dark:text-gray-500">Due By</dt>
                    <dd className="mt-0.5 text-emr-text dark:text-gray-200">{formatTs(element.dueBy)}</dd>
                </div>
                <div>
                    <dt className="font-semibold text-emr-muted dark:text-gray-500">Completed At</dt>
                    <dd className="mt-0.5 text-emr-text dark:text-gray-200">{formatTs(element.completedAt)}</dd>
                </div>
                <div>
                    <dt className="font-semibold text-emr-muted dark:text-gray-500">Completed By</dt>
                    <dd className="mt-0.5 flex items-center gap-1 text-emr-text dark:text-gray-200">
                        {element.completedBy ? (
                            <>
                                <span
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary"
                                    aria-hidden
                                >
                                    {element.completedBy
                                        .split(' ')
                                        .map((w) => w[0])
                                        .slice(0, 2)
                                        .join('')}
                                </span>
                                {element.completedBy}
                            </>
                        ) : (
                            '—'
                        )}
                    </dd>
                </div>
                <div>
                    <dt className="font-semibold text-emr-muted dark:text-gray-500">Overdue By</dt>
                    <dd
                        className={cn(
                            'mt-0.5 font-medium',
                            element.overdueBy ? 'text-emr-danger dark:text-red-400' : 'text-emr-text dark:text-gray-200',
                        )}
                    >
                        {element.overdueBy ?? '—'}
                    </dd>
                </div>
            </dl>
            <div className="mt-3">
                <label className="flex items-center gap-1 text-xs font-semibold text-emr-muted dark:text-gray-500">
                    <FileText className="h-3 w-3" aria-hidden />
                    Notes
                </label>
                <p className="mt-1 text-sm text-emr-text dark:text-gray-300">{notes || '—'}</p>
            </div>
            <div className="mt-3">
                <label
                    htmlFor={`assign-${element.id}`}
                    className="text-xs font-semibold text-emr-muted dark:text-gray-500"
                >
                    Assign To
                </label>
                <select
                    id={`assign-${element.id}`}
                    value={element.assignTo ?? ''}
                    disabled={assigningId === element.id}
                    onChange={async (e) => {
                        const assignTo = e.target.value;
                        if (!assignTo) return;
                        await onAssign(element.id, assignTo);
                    }}
                    className="mt-1 h-9 w-full rounded-lg border border-emr-border bg-white px-2 text-sm dark:border-white/10 dark:bg-[#12100e] dark:text-gray-100"
                >
                    <option value="">Select staff…</option>
                    {QUALITY_STAFF_OPTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-[10px] text-emr-muted">Current: {staffName(element.assignTo)}</p>
            </div>
            <div className="mt-3 flex gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={assigningId === element.id}
                    onClick={() => toast.info('Notes save uses PUT element when backend is live.')}
                >
                    Save notes
                </Button>
            </div>
            <p className="sr-only">
                Status icon: {QM_STATUS_ICON[element.status]} {QM_STATUS_STYLES[element.status].label}
            </p>
        </li>
    );
}

function BundleDetailPanelInner() {
    const panelOpen = useQualityMeasuresStore((s) => s.panelOpen);
    const selected = useQualityMeasuresStore((s) => s.selectedBundle);
    const closeBundlePanel = useQualityMeasuresStore((s) => s.closeBundlePanel);
    const openBundlePanel = useQualityMeasuresStore((s) => s.openBundlePanel);

    const detailQuery = useQualityEncounterDetail(
        selected?.encounterId,
        selected?.bundleKey,
        panelOpen,
    );

    const assignMutation = useAssignElementTask(selected?.measureId);
    const [assigningId, setAssigningId] = useState<string | null>(null);

    const handleAssign = async (elementId: string, assignTo: string) => {
        setAssigningId(elementId);
        try {
            await assignMutation.assign(elementId, assignTo);
        } finally {
            setAssigningId(null);
        }
    };

    return (
        <AnimatePresence>
            {panelOpen && selected && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn('fixed inset-0 z-40 md:z-50', QM_PANEL.backdrop)}
                        onClick={closeBundlePanel}
                        aria-hidden
                    />
                    <motion.aside
                        key="panel"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bundle-panel-title"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className={cn(
                            'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-2xl',
                            'md:max-w-md lg:max-w-lg',
                            'max-md:inset-0 max-md:rounded-none',
                            QM_PANEL.surface,
                        )}
                    >
                        <header
                            className={cn(
                                'flex shrink-0 items-start justify-between gap-3 px-4 py-4',
                                QM_PANEL.header,
                            )}
                        >
                            <div>
                                <h2 id="bundle-panel-title" className="text-lg font-bold text-emr-text dark:text-white">
                                    {selected.bundleLabel}
                                </h2>
                                <p className="text-sm text-emr-muted dark:text-gray-400">
                                    {selected.patientName} · {selected.mrn}
                                </p>
                                <p className="text-xs text-emr-muted">Room {selected.roomNumber}</p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={closeBundlePanel}
                                aria-label="Close panel"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </header>

                        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-emr-border px-2 py-2 dark:border-white/10">
                            {BUNDLE_COLUMNS.map((col) => (
                                <button
                                    key={col.key}
                                    type="button"
                                    onClick={() =>
                                        openBundlePanel({
                                            ...selected,
                                            bundleKey: col.key,
                                            bundleLabel: BUNDLE_LABELS[col.key],
                                        })
                                    }
                                    className={cn(
                                        'shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition',
                                        selected.bundleKey === col.key
                                            ? 'bg-primary text-white'
                                            : 'text-emr-muted hover:bg-emr-hover dark:hover:bg-white/10',
                                    )}
                                >
                                    {col.shortLabel}
                                </button>
                            ))}
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                            {detailQuery.isLoading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <PanelElementSkeleton key={i} />
                                    ))}
                                </div>
                            ) : detailQuery.isError ? (
                                <p className="text-sm text-emr-danger">Failed to load bundle elements.</p>
                            ) : detailQuery.data?.elements.length ? (
                                <ol className="space-y-4" aria-label="Bundle elements timeline">
                                    {detailQuery.data.elements.map((el) => (
                                        <ElementCard
                                            key={el.id}
                                            element={el}
                                            onAssign={handleAssign}
                                            assigningId={assigningId}
                                        />
                                    ))}
                                </ol>
                            ) : (
                                <p className="text-sm text-emr-muted">No elements for this bundle.</p>
                            )}
                        </div>

                        <footer
                            className={cn(
                                'flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3',
                                QM_PANEL.header,
                            )}
                        >
                            <span className="flex items-center gap-1 text-xs text-emr-muted">
                                <Clock className="h-3.5 w-3.5" aria-hidden />
                                Rule engine · every 4h
                            </span>
                            <Button type="button" variant="outline" size="sm" onClick={closeBundlePanel}>
                                Close
                            </Button>
                        </footer>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

export const BundleDetailPanel = memo(BundleDetailPanelInner);
