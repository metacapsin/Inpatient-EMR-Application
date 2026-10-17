import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInfectionControl } from '../../../contexts/InfectionControlContext';
import { patientHasActiveInfectionMonitoring } from '../../../lib/infectionControlUtils';
import { useCarePlan } from '../state/CarePlanContext';

export function InfectionMonitoringBanner() {
    const { patientId } = useCarePlan();
    const { records } = useInfectionControl();
    const active = patientId.trim() && patientHasActiveInfectionMonitoring(records, patientId);

    if (!active) return null;

    const chartLink = `/app/facesheet/${encodeURIComponent(patientId.trim())}/infection-control`;

    return (
        <div className="mx-4 mt-3 rounded-lg border border-sky-200/80 bg-sky-50/90 px-3 py-2.5 dark:border-sky-900/40 dark:bg-sky-950/30">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
                    <div>
                        <p className="text-xs font-bold text-sky-950 dark:text-sky-100">Infection monitoring active</p>
                        <p className="mt-0.5 text-[11px] text-sky-900/90 dark:text-sky-200/90">
                            Review isolation precautions and nursing interventions on the infection control chart.
                        </p>
                    </div>
                </div>
                <Link
                    to={chartLink}
                    className="shrink-0 text-[11px] font-semibold text-sky-800 underline-offset-2 hover:underline dark:text-sky-200"
                >
                    Open infection control
                </Link>
            </div>
        </div>
    );
}
