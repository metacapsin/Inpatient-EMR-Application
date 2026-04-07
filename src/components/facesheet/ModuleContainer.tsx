import type { PropsWithChildren } from 'react';

/**
 * Facesheet module card: fills space below encounter header; this region scrolls (not the whole window).
 */
export function ModuleContainer({ children }: PropsWithChildren) {
    return (
        <section
            className="panel flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [overscroll-behavior:contain]"
            aria-label="Clinical module"
        >
            {children}
        </section>
    );
}
