import { memo, useMemo } from 'react';
import { HardHat } from 'lucide-react';
import { useInfectionControl } from '../../contexts/InfectionControlContext';
import { ppeRequiredPatientLabels } from '../../lib/infectionControlUtils';
import type { IpdBedRow } from '../../types/ipdDashboard';

type Props = {
    bedRows: IpdBedRow[];
};

function IpdPpeAlertStripInner({ bedRows }: Props) {
    const { records } = useInfectionControl();

    const labels = useMemo(() => ppeRequiredPatientLabels(records, bedRows), [records, bedRows]);

    if (labels.length === 0) return null;

    return (
        <div className="shrink-0 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/25 sm:px-4">
            <div className="flex items-start gap-2">
                <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
                <div className="min-w-0">
                    <p className="text-xs font-bold text-red-950 dark:text-red-100">PPE required alert</p>
                    <p
                        className="mt-0.5 text-xs text-red-900/90 line-clamp-2 dark:text-red-200/90"
                        title={labels.join(' · ')}
                    >
                        Isolation precautions active for: {labels.join(' · ')}
                    </p>
                </div>
            </div>
        </div>
    );
}

export const IpdPpeAlertStrip = memo(IpdPpeAlertStripInner);
