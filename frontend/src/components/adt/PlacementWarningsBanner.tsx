import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { checkPlacement, type PlacementWarningSeverity } from '../../services/bedManagement.service';

const TONE: Record<PlacementWarningSeverity, { box: string; Icon: typeof Info }> = {
    error: {
        box: 'border-red-200/90 bg-red-50/90 text-red-950 dark:border-red-900/40 dark:bg-red-950/35 dark:text-red-100',
        Icon: ShieldAlert,
    },
    warning: {
        box: 'border-amber-200/90 bg-amber-50/90 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100',
        Icon: AlertTriangle,
    },
    info: {
        box: 'border-sky-200/90 bg-sky-50/90 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/35 dark:text-sky-100',
        Icon: Info,
    },
};

/**
 * Advisory placement check for a bed + patient: isolation precautions, isolation rooms, mixed-sex
 * shared rooms, and holds. Warnings never block the ADT action — only `error` rows reflect a rule
 * the server will reject (occupied / held for someone else / dirty).
 */
export function PlacementWarningsBanner({ bedId, patientId, encounterId }: { bedId: string; patientId?: string; encounterId?: string }) {
    const enabled = Boolean(bedId && (patientId || encounterId));
    const q = useQuery({
        queryKey: ['placement-check', bedId, patientId ?? '', encounterId ?? ''],
        queryFn: () => checkPlacement(bedId, { patientId, encounterId }),
        enabled,
        staleTime: 10_000,
    });
    if (!enabled) return null;
    if (q.isLoading) return <p className="text-xs text-gray-500 dark:text-gray-400">Checking placement…</p>;
    if (q.isError) {
        return (
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Placement check unavailable ({q.error instanceof Error ? q.error.message : 'error'}).
            </p>
        );
    }
    const data = q.data;
    const warnings = data?.warnings ?? [];
    if (!warnings.length) {
        return (
            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                No placement warnings
                {data?.room.isolationRequired ? ` · isolation room${data.room.isolationType ? ` (${data.room.isolationType})` : ''}` : ''}
                {data?.roommates.length ? ` · ${data.roommates.length} roommate(s)` : ' · private'}
            </p>
        );
    }
    return (
        <ul className="space-y-1.5" aria-label="Placement warnings">
            {warnings.map((w) => {
                const tone = TONE[w.severity] ?? TONE.info;
                return (
                    <li key={w.code} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tone.box}`}>
                        <tone.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                            {w.message}
                            {w.severity !== 'error' ? <span className="opacity-70"> Advisory only — you can still proceed.</span> : null}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
