import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DischargeReadinessView, DischargeSummaryState } from '../types/dischargeReadiness';
import { computeReadinessSnapshot, type ReadinessSnapshot } from '../utils/dischargeReadinessValidation';

function mergeSummary(base: DischargeSummaryState, draft: Partial<DischargeSummaryState> | null): DischargeSummaryState {
    if (!draft) return base;
    return { ...base, ...draft };
}

export type DischargeReadinessContextValue = {
    encounterId: string;
    view: DischargeReadinessView;
    setView: React.Dispatch<React.SetStateAction<DischargeReadinessView | null>>;
    /** Live summary form overlay so sign preconditions update while typing (before save). */
    summaryDraft: Partial<DischargeSummaryState> | null;
    setSummaryDraft: React.Dispatch<React.SetStateAction<Partial<DischargeSummaryState> | null>>;
    /** Client-side snapshot used only for form preconditions (sign). Discharge gating is server-side (`view.gates`). */
    snapshot: ReadinessSnapshot;
    clearSummaryDraft: () => void;
};

const DischargeReadinessContext = createContext<DischargeReadinessContextValue | null>(null);

type ProviderProps = {
    encounterId: string;
    view: DischargeReadinessView;
    setView: React.Dispatch<React.SetStateAction<DischargeReadinessView | null>>;
    children: React.ReactNode;
};

export function DischargeReadinessProvider({ encounterId, view, setView, children }: ProviderProps) {
    const [summaryDraft, setSummaryDraft] = useState<Partial<DischargeSummaryState> | null>(null);

    useEffect(() => {
        setSummaryDraft(null);
    }, [encounterId]);

    const snapshot = useMemo(
        () => computeReadinessSnapshot({ ...view, summary: mergeSummary(view.summary, summaryDraft) }),
        [view, summaryDraft],
    );

    const clearSummaryDraft = useCallback(() => setSummaryDraft(null), []);

    const value = useMemo(
        () => ({ encounterId, view, setView, summaryDraft, setSummaryDraft, snapshot, clearSummaryDraft }),
        [encounterId, view, setView, summaryDraft, snapshot, clearSummaryDraft],
    );

    return <DischargeReadinessContext.Provider value={value}>{children}</DischargeReadinessContext.Provider>;
}

export function useDischargeReadiness(): DischargeReadinessContextValue {
    const ctx = useContext(DischargeReadinessContext);
    if (!ctx) throw new Error('useDischargeReadiness must be used within DischargeReadinessProvider');
    return ctx;
}

export function useDischargeReadinessOptional(): DischargeReadinessContextValue | null {
    return useContext(DischargeReadinessContext);
}
