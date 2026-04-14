import { AlertTriangle } from 'lucide-react';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { useDischargeFinalizeFlow } from '../../../hooks/useDischargeFinalizeFlow';

export function DischargeReadinessBlockingAlert() {
    const { encounterId, view } = useDischargeReadiness();
    const flow = useDischargeFinalizeFlow(encounterId, view);

    if (flow.readinessQuery.isLoading) return null;
    if (!flow.gatesForUi || flow.blockingReasons.length === 0) return null;

    return (
        <div
            className="rounded-xl border border-red-200 bg-red-50/95 p-4 shadow-sm dark:border-red-900/50 dark:bg-red-950/40"
            role="alert"
        >
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/50">
                    <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-200" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-red-950 dark:text-red-50">Discharge Blocked</h3>
                    <p className="mt-1 text-sm text-red-900/90 dark:text-red-100/90">
                        Complete the following before finalizing discharge.
                    </p>
                    <ul className="mt-3 space-y-2">
                        {flow.blockingReasons.map((msg) => (
                            <li
                                key={msg}
                                className="flex gap-2 text-sm font-medium text-red-950 dark:text-red-50"
                            >
                                <span className="shrink-0" aria-hidden>
                                    ⚠️
                                </span>
                                <span>{msg}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
