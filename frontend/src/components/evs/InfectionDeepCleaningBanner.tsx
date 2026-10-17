import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useInfectionControl } from '../../contexts/InfectionControlContext';
import { patientsNeedingDeepClean } from '../../lib/infectionControlUtils';

export function InfectionDeepCleaningBanner() {
    const { records } = useInfectionControl();
    const items = useMemo(() => patientsNeedingDeepClean(records), [records]);

    if (items.length === 0) return null;

    return (
        <div className="mb-4 rounded-lg border border-violet-200/80 bg-violet-50/90 px-3 py-2.5 dark:border-violet-900/40 dark:bg-violet-950/30">
            <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden />
                <div className="min-w-0">
                    <p className="text-xs font-bold text-violet-950 dark:text-violet-100">Deep cleaning required</p>
                    <p className="mt-0.5 text-xs text-violet-900/90 dark:text-violet-200/90" title={items.join(' · ')}>
                        Active isolated infections: {items.join(' · ')}
                    </p>
                </div>
            </div>
        </div>
    );
}
