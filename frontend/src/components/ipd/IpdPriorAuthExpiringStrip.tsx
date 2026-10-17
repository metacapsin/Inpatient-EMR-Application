import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ensureEncounterPriorAuths } from '../../features/prior-auth/mock/priorAuthMockStore';
import { fetchExpiringPriorAuths, facesheetPriorAuthPath } from '../../features/prior-auth/services/priorAuth.service';
import { tenantIdFromUser } from '../../features/consent/utils/consentLinks';
import type { PriorAuthExpiringItem } from '../../features/prior-auth/types/priorAuth.types';
import type { IpdBedRow } from '../../types/ipdDashboard';
import { useSelector } from 'react-redux';
import type { IRootState } from '../../store';

type Props = {
    bedRows: IpdBedRow[];
};

function IpdPriorAuthExpiringStripInner({ bedRows }: Props) {
    const authUser = useSelector((s: IRootState) => s.auth.user);
    const tenantId = tenantIdFromUser(authUser);
    const [items, setItems] = useState<PriorAuthExpiringItem[]>([]);

    useEffect(() => {
        for (const row of bedRows) {
            const eid = row.encounterId?.trim();
            const pid = row.patientId?.trim();
            if (eid && pid) ensureEncounterPriorAuths(eid, pid, tenantId);
        }
        let cancelled = false;
        void fetchExpiringPriorAuths(tenantId).then((res) => {
            if (cancelled || !res.ok) return;
            const labels = new Map<string, string>();
            for (const row of bedRows) {
                if (row.patientId && row.patientName) labels.set(row.patientId, row.patientName);
            }
            setItems(
                res.data.map((item) => ({
                    ...item,
                    patientLabel: labels.get(item.patientId) ?? item.patientLabel,
                }))
            );
        });
        return () => {
            cancelled = true;
        };
    }, [bedRows, tenantId]);

    if (items.length === 0) return null;

    return (
        <div className="shrink-0 rounded-xl border border-orange-200/80 bg-orange-50/90 px-3 py-2.5 dark:border-orange-900/40 dark:bg-orange-950/25 sm:px-4">
            <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-800 dark:text-orange-300" aria-hidden />
                <div className="min-w-0">
                    <p className="text-xs font-bold text-orange-950 dark:text-orange-100">
                        Prior auth expiring ({items.length})
                    </p>
                    <p
                        className="mt-0.5 text-xs text-orange-900/90 line-clamp-2 dark:text-orange-200/90"
                        title={items
                            .map(
                                (i) =>
                                    `${i.patientLabel}: ${i.serviceType} (${i.daysRemaining < 1 ? '<1d' : `${i.daysRemaining}d`})`
                            )
                            .join(' · ')}
                    >
                        {items.map((item, idx) => (
                            <span key={item.authId}>
                                {idx > 0 ? ' · ' : ''}
                                {item.patientId ? (
                                    <Link
                                        to={facesheetPriorAuthPath(item.patientId)}
                                        className="font-semibold underline-offset-2 hover:underline"
                                    >
                                        {item.patientLabel}
                                    </Link>
                                ) : (
                                    item.patientLabel
                                )}
                                {' '}
                                ({item.serviceType}
                                {item.daysRemaining < 1 ? ', <1 day' : `, ${item.daysRemaining}d`})
                            </span>
                        ))}
                    </p>
                </div>
            </div>
        </div>
    );
}

export const IpdPriorAuthExpiringStrip = memo(IpdPriorAuthExpiringStripInner);
