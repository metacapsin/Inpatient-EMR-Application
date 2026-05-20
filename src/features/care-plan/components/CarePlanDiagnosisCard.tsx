import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import type { CarePlanDiagnosis } from '../types/carePlan.types';
import { PRIORITY_CHIP_CLASS } from '../constants/carePlanOptions';
import { goalCompletionPercent } from '../utils/goalProgress';

type CarePlanDiagnosisCardProps = {
    diagnosis: CarePlanDiagnosis;
    selected: boolean;
    collapsed: boolean;
    onToggleCollapse: () => void;
    onSelect: () => void;
};

export function CarePlanDiagnosisCard({
    diagnosis,
    selected,
    collapsed,
    onToggleCollapse,
    onSelect,
}: CarePlanDiagnosisCardProps) {
    const pct = goalCompletionPercent(diagnosis);
    const added = diagnosis.addedAt ? format(new Date(diagnosis.addedAt), 'MM/dd/yy') : '—';

    return (
        <article
            className={`rounded-lg border transition-all duration-200 ${
                selected
                    ? 'border-primary/50 bg-primary-50/40 shadow-sm ring-1 ring-primary/20 dark:border-primary-800/50 dark:bg-primary-950/25'
                    : 'border-gray-200/90 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-[#141210] dark:hover:border-white/20'
            }`}
        >
            <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                onClick={onSelect}
            >
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug text-gray-900 dark:text-gray-100">{diagnosis.nandaLabel}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-gray-500 dark:text-gray-400">{diagnosis.nandaCode}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${PRIORITY_CHIP_CLASS[diagnosis.priority]}`}
                        >
                            {diagnosis.priority}
                        </span>
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-300">
                            {diagnosis.status}
                        </span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                            <span>Goals</span>
                            <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                        {diagnosis.addedBy} · {added}
                    </p>
                </div>
                <button
                    type="button"
                    className="mt-0.5 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                    aria-label={collapsed ? 'Expand card' : 'Collapse card'}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollapse();
                    }}
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                </button>
            </button>
            {!collapsed ? (
                <div className="border-t border-gray-100 px-3 py-2 text-[10px] text-gray-600 dark:border-white/10 dark:text-gray-400">
                    <p>
                        <span className="font-semibold">Related to:</span> {diagnosis.relatedTo || '—'}
                    </p>
                    <p className="mt-1">
                        <span className="font-semibold">Evidenced by:</span> {diagnosis.evidencedBy || '—'}
                    </p>
                </div>
            ) : null}
        </article>
    );
}
