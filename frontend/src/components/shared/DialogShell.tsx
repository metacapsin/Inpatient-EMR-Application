import type { ReactNode } from 'react';
import { useId } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { cn } from '../../lib/utils';

export interface DialogShellProps {
    open: boolean;
    onClose: () => void;
    /** Visible title text; rendered by the caller inside `children` using `titleId` for aria-labelledby. */
    title: string;
    children: (ids: { titleId: string }) => ReactNode;
    /** Classes for the panel (width, colours). */
    panelClassName?: string;
    /** Classes for the overlay wrapper. */
    className?: string;
    zIndexClassName?: string;
}

/**
 * Minimal accessible wrapper for legacy hand-rolled modals: overlay click + Escape close, focus trap
 * and restore, `role="dialog"` / `aria-modal` / `aria-labelledby`. Visual styling stays with the caller
 * so existing module designs are preserved.
 */
export function DialogShell({ open, onClose, title, children, panelClassName, className, zIndexClassName = 'z-50' }: DialogShellProps) {
    const titleId = useId();
    const panelRef = useDialogA11y<HTMLDivElement>(open, onClose);
    if (!open) return null;
    return (
        <div className={cn('fixed inset-0 flex items-center justify-center bg-black/60 p-4', zIndexClassName, className)}>
            <button type="button" className="absolute inset-0 cursor-default" aria-label={`Close ${title}`} onClick={onClose} tabIndex={-1} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn('relative outline-none', panelClassName)}
            >
                {children({ titleId })}
            </div>
        </div>
    );
}
