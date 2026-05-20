import type { FlowsheetCarePlanSuggestion } from '../types/carePlan.types';

/** Nursing flowsheet risk → NANDA suggestions (no extra schema fields). */
export function suggestionsFromFlowsheetSignals(signals: {
    highFallRisk?: boolean;
    lowBraden?: boolean;
    painScoreOver7?: boolean;
}): FlowsheetCarePlanSuggestion[] {
    const out: FlowsheetCarePlanSuggestion[] = [];
    if (signals.highFallRisk) {
        out.push({
            id: 'sug-falls',
            nandaCode: '00146',
            nandaLabel: 'Risk for Falls',
            reason: 'High fall risk documented on nursing flowsheet',
        });
    }
    if (signals.lowBraden) {
        out.push({
            id: 'sug-skin',
            nandaCode: '00085',
            nandaLabel: 'Risk for Impaired Skin Integrity',
            reason: 'Low Braden score on nursing flowsheet',
        });
    }
    if (signals.painScoreOver7) {
        out.push({
            id: 'sug-pain',
            nandaCode: '00132',
            nandaLabel: 'Acute Pain',
            reason: 'Pain score greater than 7 on nursing flowsheet',
        });
    }
    return out;
}
