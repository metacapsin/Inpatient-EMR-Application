import { Lightbulb } from 'lucide-react';
import AppButton from '@/components/ui/AppButton';
import { useCarePlan } from '../state/CarePlanContext';
import { searchNandaCatalog } from '../mock/nandaCatalog';

export function CarePlanSuggestionsBanner() {
    const { suggestions, addDiagnosisFromNanda, plan } = useCarePlan();
    if (!suggestions.length) return null;

    const existingCodes = new Set((plan?.diagnoses || []).map((d) => d.nandaCode));

    return (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-950 dark:text-amber-100">Nursing flowsheet suggestions</p>
                    <ul className="mt-2 space-y-2">
                        {suggestions.map((s) => {
                            const added = existingCodes.has(s.nandaCode);
                            return (
                                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0 text-[11px] text-amber-900/90 dark:text-amber-200/90">
                                        <span className="font-semibold">{s.nandaLabel}</span>
                                        <span className="text-amber-800/70 dark:text-amber-300/70"> — {s.reason}</span>
                                    </div>
                                    <AppButton
                                        type="button"
                                        className="!h-7 !px-2 !text-[10px]"
                                        disabled={added}
                                        onClick={() => {
                                            const nanda = searchNandaCatalog(s.nandaCode)[0];
                                            if (nanda) addDiagnosisFromNanda(nanda, { priority: 'High' });
                                        }}
                                    >
                                        {added ? 'On plan' : 'Add'}
                                    </AppButton>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
}
