import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ClaimPrepState, DischargeReadinessView, DischargeSummaryState } from '../types/dischargeReadiness';
import {
    computeReadinessSnapshot,
    type ReadinessSnapshot,
} from '../utils/dischargeReadinessValidation';

function mergeSummary(base: DischargeSummaryState, draft: Partial<DischargeSummaryState> | null): DischargeSummaryState {
    if (!draft) return base;
    return { ...base, ...draft };
}

function mergeClaimPrep(base: ClaimPrepState, draft: Partial<ClaimPrepState> | null): ClaimPrepState {
    if (!draft) return base;
    return { ...base, ...draft };
}

export type DischargeReadinessContextValue = {
    encounterId: string;
    view: DischargeReadinessView;
    setView: React.Dispatch<React.SetStateAction<DischargeReadinessView | null>>;
    /** Live form overlays so blockers update while typing (before save). */
    summaryDraft: Partial<DischargeSummaryState> | null;
    setSummaryDraft: React.Dispatch<React.SetStateAction<Partial<DischargeSummaryState> | null>>;
    claimPrepDraft: Partial<ClaimPrepState> | null;
    setClaimPrepDraft: React.Dispatch<React.SetStateAction<Partial<ClaimPrepState> | null>>;
    snapshot: ReadinessSnapshot;
    clearSummaryDraft: () => void;
    clearClaimPrepDraft: () => void;
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
    const [claimPrepDraft, setClaimPrepDraft] = useState<Partial<ClaimPrepState> | null>(null);

    useEffect(() => {
        setSummaryDraft(null);
        setClaimPrepDraft(null);
    }, [encounterId]);

    const snapshot = useMemo(() => {
        const merged: DischargeReadinessView = {
            ...view,
            summary: mergeSummary(view.summary, summaryDraft),
            claimPrep: mergeClaimPrep(view.claimPrep, claimPrepDraft),
        };
        return computeReadinessSnapshot(merged);
    }, [view, summaryDraft, claimPrepDraft]);

    const clearSummaryDraft = useCallback(() => setSummaryDraft(null), []);
    const clearClaimPrepDraft = useCallback(() => setClaimPrepDraft(null), []);

    const value = useMemo(
        () => ({
            encounterId,
            view,
            setView,
            summaryDraft,
            setSummaryDraft,
            claimPrepDraft,
            setClaimPrepDraft,
            snapshot,
            clearSummaryDraft,
            clearClaimPrepDraft,
        }),
        [encounterId, view, setView, summaryDraft, claimPrepDraft, snapshot, clearSummaryDraft, clearClaimPrepDraft],
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
