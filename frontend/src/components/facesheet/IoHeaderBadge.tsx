import { useQuery } from '@tanstack/react-query';
import { Droplets } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { getIoBalance } from '../../services/ioRecord.service';
import { balanceSeverity, balanceToneClass, formatBalanceMl, urineOutputAlert } from '../../features/io-tracking/utils/balancePresentation';

const BADGE_BASE =
    'inline-flex max-w-full shrink-0 items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal ring-1';

export function IoHeaderBadge() {
    const { id: patientId = '' } = useParams<{ id: string }>();
    const session = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));
    const encounterId = session?.encounterId?.trim() ?? '';

    const balanceQuery = useQuery({
        queryKey: ['ioBalance', 'header', encounterId],
        queryFn: () => getIoBalance(encounterId),
        enabled: Boolean(encounterId),
        staleTime: 60_000,
        retry: false,
    });

    if (!encounterId || balanceQuery.isError || !balanceQuery.data) return null;

    const summary = balanceQuery.data;
    const sev = balanceSeverity(summary.balance24hMl);
    const lowUrine = urineOutputAlert(summary);
    const tone = balanceToneClass(sev);

    const ringClass =
        sev === 'critical'
            ? 'bg-red-50 text-red-800 ring-red-400/30 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-500/30'
            : sev === 'caution'
              ? 'bg-amber-50 text-amber-900 ring-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-500/30'
              : 'bg-emerald-50 text-emerald-900 ring-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-500/30';

    return (
        <Link
            to={`/app/facesheet/${patientId}/clinical/nursing-flowsheet?sub=io`}
            className={`${BADGE_BASE} ${ringClass} hover:opacity-90`}
            title={`24h balance ${formatBalanceMl(summary.balance24hMl)}${lowUrine ? ' · Low urine output' : ''}`}
        >
            <Droplets className={`h-3 w-3 shrink-0 ${tone}`} aria-hidden />
            <span className="font-medium text-gray-500 dark:text-gray-400">I&amp;O</span>
            <span className={`tabular-nums ${tone}`}>{formatBalanceMl(summary.balance24hMl)}</span>
        </Link>
    );
}
