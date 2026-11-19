import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useDischargeReadiness } from '../../../contexts/DischargeReadinessContext';
import { useDischargeFinalizeFlow } from '../../../hooks/useDischargeFinalizeFlow';
import { fetchCarePlan } from '../../../features/care-plan/api/carePlanWithFallback';
import { carePlanDischargeWarnings } from '../../../features/care-plan/utils/dischargeCarePlanCheck';
import { getConsentCompleteness, consentDischargeBlockingMessages } from '../../../services/consent.service';

/**
 * "Discharge blocked" alert. Hard lines come only from the server's discharge gates; care-plan and consent
 * lines are advisory (the server does not gate on them yet) and are labelled as such.
 */
export function DischargeReadinessBlockingAlert() {
    const { encounterId, view } = useDischargeReadiness();
    const flow = useDischargeFinalizeFlow(encounterId, view);
    const patientId = view.context.patientId?.trim() ?? '';

    const carePlanQuery = useQuery({
        queryKey: ['carePlanDischargeCheck', encounterId, patientId],
        queryFn: () => fetchCarePlan(encounterId, patientId, 'tenant-default'),
        enabled: Boolean(encounterId && patientId),
        staleTime: 60_000,
        retry: false,
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
        retry: false,
    });

    const advisory = useMemo(() => {
        const care = carePlanQuery.data ? carePlanDischargeWarnings(carePlanQuery.data) : [];
        const consent = consentQuery.data ? consentDischargeBlockingMessages(consentQuery.data) : [];
        return [...care, ...consent];
    }, [carePlanQuery.data, consentQuery.data]);

    if (flow.readinessQuery.isLoading) return null;
    const blocking = flow.blockingReasons;
    if (blocking.length === 0 && advisory.length === 0) return null;

    return (
        <div
            className={`border-l-4 py-1.5 pl-2 pr-2 ${
                blocking.length
                    ? 'border-red-500 bg-red-50/70 dark:border-red-600 dark:bg-red-950/25'
                    : 'border-amber-400 bg-amber-50/70 dark:border-amber-500 dark:bg-amber-950/25'
            }`}
            role={blocking.length ? 'alert' : 'status'}
        >
            <div className="flex gap-2">
                <AlertTriangle
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${blocking.length ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    {blocking.length ? (
                        <>
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-xs font-semibold text-red-950 dark:text-red-50">Discharge blocked</span>
                                <span className="text-[11px] leading-snug text-red-900/90 dark:text-red-100/85">
                                    The server will refuse discharge until these are resolved.
                                </span>
                            </div>
                            <ul className="mt-1 space-y-0.5">
                                {blocking.map((msg, i) => (
                                    <li key={`${i}-${msg}`} className="flex gap-1.5 text-[11px] font-medium leading-snug text-red-950 dark:text-red-50">
                                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-600 dark:bg-red-400" aria-hidden />
                                        <span>{msg}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                    {advisory.length ? (
                        <>
                            <div className={`flex flex-wrap items-baseline gap-x-2 ${blocking.length ? 'mt-1.5' : ''}`}>
                                <span className="text-xs font-semibold text-amber-950 dark:text-amber-50">Review before discharge</span>
                                <span className="text-[11px] leading-snug text-amber-900/90 dark:text-amber-100/85">
                                    Advisory only; not enforced by the server.
                                </span>
                            </div>
                            <ul className="mt-1 space-y-0.5">
                                {advisory.map((msg, i) => (
                                    <li key={`a-${i}-${msg}`} className="flex gap-1.5 text-[11px] leading-snug text-amber-950 dark:text-amber-50">
                                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
                                        <span>{msg}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
