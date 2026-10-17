import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type ActionIconTooltipProps = {
    label: string;
    children: ReactNode;
    /** Tooltip above the trigger (default) or below */
    side?: 'top' | 'bottom';
    className?: string;
};

/**
 * Custom tooltip for icon-only actions: no native `title`, fixed positioning so it is not clipped
 * by overflow scroll areas, small dark panel with a short fade-in.
 */
export function ActionIconTooltip({ label, children, side = 'top', className }: ActionIconTooltipProps) {
    const wrapRef = useRef<HTMLSpanElement>(null);
    const [open, setOpen] = useState(false);
    const [fadeIn, setFadeIn] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const updatePosition = useCallback(() => {
        const el = wrapRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const gap = 6;
        if (side === 'top') {
            setCoords({ top: r.top - gap, left: r.left + r.width / 2 });
        } else {
            setCoords({ top: r.bottom + gap, left: r.left + r.width / 2 });
        }
    }, [side]);

    useLayoutEffect(() => {
        if (!open) {
            setFadeIn(false);
            return;
        }

        updatePosition();
        let raf = 0;
        raf = requestAnimationFrame(() => setFadeIn(true));

        const onReposition = () => updatePosition();
        window.addEventListener('scroll', onReposition, true);
        window.addEventListener('resize', onReposition);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onReposition, true);
            window.removeEventListener('resize', onReposition);
        };
    }, [open, side, updatePosition]);

    const transform = side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';

    const tip =
        open && typeof document !== 'undefined' ? (
            <div
                role="tooltip"
                style={{
                    position: 'fixed',
                    top: coords.top,
                    left: coords.left,
                    transform,
                    opacity: fadeIn ? 1 : 0,
                    transition: 'opacity 180ms ease-out',
                    zIndex: 9999,
                }}
                className={cn(
                    'pointer-events-none max-w-[min(18rem,calc(100vw-1rem))] rounded-md bg-neutral-950 px-2 py-1 text-center text-[11px] font-medium leading-snug text-white shadow-lg dark:bg-black'
                )}
            >
                {label}
            </div>
        ) : null;

    return (
        <>
            <span
                ref={wrapRef}
                className={cn('inline-flex', className)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocusCapture={() => setOpen(true)}
                onBlurCapture={() => setOpen(false)}
            >
                {children}
            </span>
            {tip ? createPortal(tip, document.body) : null}
        </>
    );
}
