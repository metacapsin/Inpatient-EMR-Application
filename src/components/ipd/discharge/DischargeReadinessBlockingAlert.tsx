import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { useDischargeFinalizeFlow } from '../../../hooks/useDischargeFinalizeFlow';
import { fetchCarePlan } from '../../../features/care-plan/api/carePlanWithFallback';
import { carePlanDischargeWarnings } from '../../../features/care-plan/utils/dischargeCarePlanCheck';
import { getConsentCompleteness, consentDischargeBlockingMessages } from '../../../services/consent.service';

export function DischargeReadinessBlockingAlert() {
    const { encounterId, view } = useDischargeReadiness();
    const flow = useDischargeFinalizeFlow(encounterId, view);
    const patientId = view.context.patientId?.trim() ?? '';

    const carePlanQuery = useQuery({
        queryKey: ['carePlanDischargeCheck', encounterId, patientId],
        queryFn: () => fetchCarePlan(encounterId, patientId, 'tenant-default'),
        enabled: Boolean(encounterId && patientId),
        staleTime: 60_000,
    });

    const consentQuery = useQuery({
        queryKey: ['consentCompletenessDischarge', encounterId],
        queryFn: async () => {
            const r = await getConsentCompleteness(encounterId);
            if (!r.ok) throw new Error(r.message);
            return r.data;
        },
        enabled: Boolean(encounterId.trim()),
        staleTime: 60_000,
    });

    const blockingReasons = useMemo(() => {
        const care = carePlanDischargeWarnings(carePlanQuery.data);
        const consent = consentDischargeBlockingMessages(consentQuery.data);
        return [...flow.blockingReasons, ...care, ...consent];
    }, [flow.blockingReasons, carePlanQuery.data, consentQuery.data]);

    if (flow.readinessQuery.isLoading) return null;
    if (blockingReasons.length === 0) return null;

    return (
        <div
            className="border-l-4 border-red-500 bg-red-50/70 py-1.5 pl-2 pr-2 dark:border-red-600 dark:bg-red-950/25"
            role="alert"
        >
            <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold text-red-950 dark:text-red-50">Discharge blocked</span>
                        <span className="text-[11px] leading-snug text-red-900/90 dark:text-red-100/85">
                            Finish the items below before finalizing discharge.
                        </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                        {blockingReasons.map((msg, i) => (
                            <li
                                key={`${i}-${msg}`}
                                className="flex gap-1.5 text-[11px] font-medium leading-snug text-red-950 dark:text-red-50"
                            >
                                <span
                                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-600 dark:bg-red-400"
                                    aria-hidden
                                />
                                <span>{msg}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
