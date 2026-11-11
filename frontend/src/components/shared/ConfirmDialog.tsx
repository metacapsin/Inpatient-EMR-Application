import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, CheckCircle2, Trash2 } from 'lucide-react';
import { AppModal } from './AppModal';

export type ConfirmVariant = 'danger' | 'warning' | 'primary';

export type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message: string;
    /** Optional secondary detail (e.g. allergen / client name). */
    detail?: string;
    /** Optional extra body (lists, type-to-confirm inputs, etc.). */
    children?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
    busy?: boolean;
    /** Extra gate (e.g. type-to-confirm name mismatch). */
    confirmDisabled?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

const VARIANT: Record<
    ConfirmVariant,
    { icon: ReactNode; confirmClass: string; busyLabel: string }
> = {
    danger: {
        icon: <Trash2 className="h-5 w-5" aria-hidden />,
        confirmClass:
            'inline-flex h-9 items-center justify-center rounded-lg bg-danger px-3.5 text-sm font-semibold leading-none text-white transition hover:opacity-90 disabled:opacity-60',
        busyLabel: 'Deleting…',
    },
    warning: {
        icon: <Ban className="h-5 w-5" aria-hidden />,
        confirmClass:
            'inline-flex h-9 items-center justify-center rounded-lg bg-amber-600 px-3.5 text-sm font-semibold leading-none text-white transition hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600',
        busyLabel: 'Updating…',
    },
    primary: {
        icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
        confirmClass:
            'inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold leading-none text-white transition hover:opacity-90 disabled:opacity-60',
        busyLabel: 'Saving…',
    },
};

/** Premium EMR confirmation — use instead of window.confirm / browser prompts. */
export function ConfirmDialog({
    open,
    title,
    message,
    detail,
    children,
    confirmLabel,
    cancelLabel = 'Cancel',
    variant = 'danger',
    busy = false,
    confirmDisabled = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (typeof document === 'undefined') return null;

    const v = VARIANT[variant];
    const label = confirmLabel ?? (variant === 'danger' ? 'Delete' : 'Confirm');

    return createPortal(
        <AppModal
            open={open}
            title={title}
            icon={v.icon}
            size="sm"
            className="!max-h-[min(90vh,32rem)]"
            bodyClassName="!flex-none space-y-3 !py-3"
            footerClassName="!py-3"
            onClose={busy ? () => undefined : onCancel}
            footer={
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-primary px-3.5 text-sm font-semibold leading-none text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </button>
                    <button type="button" className={v.confirmClass} onClick={onConfirm} disabled={busy || confirmDisabled}>
                        {busy ? v.busyLabel : label}
                    </button>
                </div>
            }
        >
            <p className="break-words text-sm leading-relaxed text-gray-600 dark:text-gray-400">{message}</p>
            {detail ? (
                <div className="min-w-0 rounded-lg border border-emr-border/80 bg-emr-hover/30 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Record</p>
                    <p className="mt-0.5 break-words text-sm font-medium text-gray-900 dark:text-gray-100">{detail}</p>
                </div>
            ) : null}
            {children}
            {!detail && !children ? (
                <div className="flex min-w-0 items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">
                        Please confirm before continuing. This action is recorded in the patient chart.
                    </span>
                </div>
            ) : null}
        </AppModal>,
        document.body,
    );
}
