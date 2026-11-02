import { useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { listAdtNotifications } from '../../services/adtNotifications.service';
import { AdtNotificationLogTable } from './AdtNotificationLogTable';

/** Per-patient ADT notification log (CMS CoP) shown under the ADT workspace. */
export function AdtNotificationsPanel({ patientId }: { patientId: string }) {
    const q = useQuery({
        queryKey: ['adtNotifications', patientId],
        queryFn: () => listAdtNotifications({ patientId, limit: 50 }),
        enabled: Boolean(patientId),
        refetchInterval: 15_000,
    });
    if (!patientId) return null;
    return (
        <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-[#161412]" aria-labelledby="adt-notifications-heading">
            <div className="mb-3 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary" aria-hidden />
                <h2 id="adt-notifications-heading" className="text-sm font-semibold text-gray-900 dark:text-white">Care notifications (ADT A01 / A02 / A03)</h2>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">PCP &amp; post-acute providers are notified on every admission, transfer and discharge.</span>
            </div>
            {q.isLoading ? <p className="text-[13px] text-gray-500">Loading…</p> : <AdtNotificationLogTable rows={q.data ?? []} onChanged={() => { void q.refetch(); }} />}
        </section>
    );
}
