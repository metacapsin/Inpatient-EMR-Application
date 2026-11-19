import { useEffect, useRef } from 'react';

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibility behaviour for modal dialogs: Escape closes, focus moves into the panel on open,
 * Tab/Shift+Tab are trapped inside it, and focus is restored to the opener on close.
 * Attach the returned ref to the dialog panel element.
 */
export function useDialogA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
    const panelRef = useRef<T | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const focusFirst = () => {
            const node = panelRef.current;
            if (!node) return;
            const first = node.querySelector<HTMLElement>(FOCUSABLE);
            (first ?? node).focus();
        };
        const t = window.setTimeout(focusFirst, 0);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab' || !panelRef.current) return;
            const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                (el) => el.offsetParent !== null || el === document.activeElement
            );
            if (!items.length) {
                e.preventDefault();
                panelRef.current.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement as HTMLElement | null;
            if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            window.clearTimeout(t);
            document.removeEventListener('keydown', onKey, true);
            if (opener && document.contains(opener) && panel !== null) opener.focus();
        };
    }, [open]);

    return panelRef;
}
