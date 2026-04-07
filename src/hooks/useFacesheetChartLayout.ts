import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const FACESHEET_CHART_PATH = /^\/app\/facesheet\/[^/]+/;

/**
 * True when the current route is an inpatient chart module (`/app/facesheet/:id/...`).
 */
export function useIsFacesheetChart(): boolean {
    const { pathname } = useLocation();
    return useMemo(() => FACESHEET_CHART_PATH.test(pathname), [pathname]);
}

/**
 * Layout tokens for patient modules: facesheet uses {@link ModuleContainer} as the only outer card —
 * module roots stay flat (no second card, no fixed-height inner scroll). Legacy routes keep panel + scroll.
 */
export function useFacesheetChartLayout() {
    const isFacesheet = useIsFacesheetChart();

    return useMemo(
        () => ({
            isFacesheet,
            /** Replaces `panel h-[calc(100vh-120px)] overflow-y-auto` on module roots */
            moduleRootClass: isFacesheet
                ? 'w-full min-w-0 max-w-none overflow-visible [height:auto]'
                : 'panel h-[calc(100vh-120px)] overflow-y-auto',
            /** Replaces a plain outer `panel` (Labs, Notes, Lab Orders) */
            moduleSurfaceClass: isFacesheet
                ? 'w-full min-w-0 max-w-none overflow-visible [height:auto]'
                : 'panel',
        }),
        [isFacesheet]
    );
}
