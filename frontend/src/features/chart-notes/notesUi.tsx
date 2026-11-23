import type { ReactNode } from 'react';
import { Skeleton } from 'primereact/skeleton';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import type { ChartNoteStatus } from '../../services/patientChartNotes.service';
import './notesModule.css';

/** Keep overlay panel width equal to the trigger control. */
export function syncOverlayWidth(trigger: HTMLElement | null | undefined, panelSelector: string, cssVar: string) {
    requestAnimationFrame(() => {
        const panel = document.querySelector(panelSelector) as HTMLElement | null;
        if (!trigger || !panel) return;
        const w = `${Math.max(trigger.offsetWidth, 120)}px`;
        panel.style.setProperty(cssVar, w);
        panel.style.width = w;
        panel.style.minWidth = w;
        panel.style.maxWidth = w;
    });
}

export function notesDropdownOptionTemplate(option: { label?: string; value?: string } | string) {
    const label = typeof option === 'string' ? option : option?.label || String(option?.value ?? '');
    return (
        <span className="notes-dd-option" title={label}>
            {label}
        </span>
    );
}

export function notesDropdownValueTemplate(
    option: { label?: string; value?: string } | string | null,
    props: { placeholder?: string },
) {
    if (option == null || option === '') {
        return <span className="notes-dd-option p-placeholder">{props.placeholder || 'Select'}</span>;
    }
    return notesDropdownOptionTemplate(option);
}

export function noteStatusSeverity(status: ChartNoteStatus | string): 'success' | 'warning' | 'danger' | 'info' {
    if (status === 'Completed') return 'success';
    if (status === 'Marked in Error') return 'danger';
    return 'warning';
}

export function NoteStatusTag({ status }: { status: ChartNoteStatus | string }) {
    const Icon =
        status === 'Completed' ? CheckCircle2 : status === 'Marked in Error' ? AlertTriangle : Pencil;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                status === 'Completed'
                    ? 'bg-success/15 text-success'
                    : status === 'Marked in Error'
                      ? 'bg-danger/15 text-danger'
                      : 'bg-warning/15 text-warning'
            }`}
            role="status"
        >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {status}
        </span>
    );
}

/** Shared clinical section chrome — listing/create/edit consistency. */
export function ClinicalNoteSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
    return (
        <section className={`mb-4 overflow-visible rounded-xl border border-emr-border/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0e1726] ${className}`}>
            <header className="rounded-t-xl border-b border-emr-border/70 bg-[#faf8f6] px-4 py-2.5 dark:border-white/10 dark:bg-[#161311]">
                <h4 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h4>
            </header>
            <div className="space-y-3 overflow-visible p-4">{children}</div>
        </section>
    );
}

export function ClinicalFieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
    return (
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
            {children}
            {required ? <span className="text-danger"> *</span> : null}
        </label>
    );
}

/**
 * Document-flow action footer (not fixed/sticky) so clinical fields are never obscured.
 * Prefer full-page scroll over nested sticky bars.
 */
export function ClinicalNoteActionBar({ children }: { children: ReactNode }) {
    return (
        <div className="mt-6 -mx-1 border-t border-emr-border/80 bg-white pt-4 dark:border-white/10 dark:bg-[#0e1726]">
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-emr-border/80 bg-[#faf8f6] px-3 py-3 shadow-sm dark:border-white/10 dark:bg-[#161311]">
                {children}
            </div>
        </div>
    );
}

/** Listing card placeholders while notes API loads. */
export function NotesListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3" aria-busy="true" aria-label="Loading notes">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-xl border border-emr-border/80 bg-white p-4 dark:border-white/10 dark:bg-[#12100e]"
                >
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Skeleton shape="circle" size="0.5rem" />
                            <Skeleton width="55%" height="1rem" />
                            <Skeleton width="4.5rem" height="1.25rem" borderRadius="6px" />
                        </div>
                        <Skeleton width="5.5rem" height="0.75rem" />
                    </div>
                    <Skeleton width="100%" height="0.85rem" className="mb-2" />
                    <Skeleton width="88%" height="0.85rem" className="mb-4" />
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emr-border/60 pt-3 dark:border-white/10">
                        <Skeleton width="8rem" height="0.85rem" />
                        <div className="flex gap-2">
                            <Skeleton width="4.25rem" height="2rem" borderRadius="6px" />
                            <Skeleton width="6.5rem" height="2rem" borderRadius="6px" />
                            <Skeleton width="4.5rem" height="2rem" borderRadius="6px" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Create / view / edit shell while a note document loads. */
export function NoteFormSkeleton() {
    return (
        <div className="notes-module w-full min-w-0" aria-busy="true" aria-label="Loading note">
            <div className="mb-5 border-b border-emr-border/80 pb-4 dark:border-white/10">
                <Skeleton width="12rem" height="0.85rem" className="mb-2" />
                <div className="flex items-center justify-between gap-3">
                    <Skeleton width="14rem" height="1.5rem" />
                    <Skeleton width="4.5rem" height="2rem" borderRadius="6px" />
                </div>
            </div>

            <section className="mb-4 overflow-hidden rounded-xl border border-emr-border/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0e1726]">
                <header className="border-b border-emr-border/70 bg-[#faf8f6] px-4 py-2.5 dark:border-white/10 dark:bg-[#161311]">
                    <Skeleton width="7rem" height="0.95rem" />
                </header>
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                    <div>
                        <Skeleton width="5rem" height="0.75rem" className="mb-2" />
                        <Skeleton width="100%" height="2rem" borderRadius="6px" />
                    </div>
                    <div>
                        <Skeleton width="5.5rem" height="0.75rem" className="mb-2" />
                        <Skeleton width="100%" height="2rem" borderRadius="6px" />
                    </div>
                    <div>
                        <Skeleton width="7rem" height="0.75rem" className="mb-2" />
                        <Skeleton width="100%" height="2rem" borderRadius="6px" />
                    </div>
                    <div className="md:col-span-3">
                        <Skeleton width="5rem" height="0.75rem" className="mb-2" />
                        <Skeleton width="100%" height="2rem" borderRadius="6px" />
                    </div>
                </div>
            </section>

            <section className="mb-4 overflow-hidden rounded-xl border border-emr-border/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0e1726]">
                <header className="border-b border-emr-border/70 bg-[#faf8f6] px-4 py-2.5 dark:border-white/10 dark:bg-[#161311]">
                    <Skeleton width="9rem" height="0.95rem" />
                </header>
                <div className="space-y-3 p-4">
                    <Skeleton width="70%" height="0.75rem" />
                    <Skeleton width="100%" height="18rem" borderRadius="8px" />
                    <div className="flex justify-between">
                        <Skeleton width="8rem" height="0.75rem" />
                        <Skeleton width="2rem" height="0.75rem" />
                    </div>
                </div>
            </section>

            <div className="mt-6 flex flex-wrap justify-end gap-2 rounded-xl border border-emr-border/80 bg-[#faf8f6] px-3 py-3 dark:border-white/10 dark:bg-[#161311]">
                <Skeleton width="4.5rem" height="2.25rem" borderRadius="6px" />
                <Skeleton width="5.5rem" height="2.25rem" borderRadius="6px" />
                <Skeleton width="6.5rem" height="2.25rem" borderRadius="6px" />
            </div>
        </div>
    );
}
