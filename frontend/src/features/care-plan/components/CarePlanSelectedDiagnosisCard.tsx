import { Tag } from 'lucide-react';
import type { NandaSearchResult } from '../types/carePlan.types';
import { CARE_PLAN_SELECTED_DX_CARD_CLASS } from '../constants/carePlanLayout';

type CarePlanSelectedDiagnosisCardProps = {
    diagnosis: NandaSearchResult;
};

export function CarePlanSelectedDiagnosisCard({ diagnosis }: CarePlanSelectedDiagnosisCardProps) {
    return (
        <div className={CARE_PLAN_SELECTED_DX_CARD_CLASS} role="status" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                    <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-white/80 text-primary dark:bg-[#1a1816]"
                        aria-hidden
                    >
                        <Tag className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Selected diagnosis</p>
                        <p className="mt-0.5 text-sm font-semibold leading-snug text-gray-900 dark:text-white">{diagnosis.label}</p>
                    </div>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-lg border border-primary/25 bg-white/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-primary shadow-sm dark:bg-[#1a1816]">
                    {diagnosis.code}
                </span>
            </div>
        </div>
    );
}
