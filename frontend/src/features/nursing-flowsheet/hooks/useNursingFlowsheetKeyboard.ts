import { useCallback, useEffect } from 'react';

export interface NursingFlowsheetKeyboardOptions {
    onSaveNow: () => void;
    onToggleHistory: () => void;
    onFocusSection: (index: number) => void;
}

/** Global chord shortcuts — scoped to chart surface via data attribute. */
export function useNursingFlowsheetKeyboard({ onSaveNow, onToggleHistory, onFocusSection }: NursingFlowsheetKeyboardOptions) {
    const handler = useCallback(
        (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (!t?.closest?.('[data-nursing-flowsheet-surface="true"]')) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                onSaveNow();
                return;
            }
            if (e.altKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                onToggleHistory();
                return;
            }
            if (e.altKey && /^[1-9]$/.test(e.key)) {
                e.preventDefault();
                const idx = Number(e.key) - 1;
                onFocusSection(idx);
                return;
            }
            if (e.altKey && e.key === '0') {
                e.preventDefault();
                onFocusSection(9);
            }
        },
        [onFocusSection, onSaveNow, onToggleHistory]
    );

    useEffect(() => {
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handler]);
}
