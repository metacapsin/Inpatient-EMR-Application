import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Clock, Shield, Waves } from 'lucide-react';
import type { NurseAssignmentRow } from '../../../../types/staffing.types';
import { OVERTIME_HOURS_THRESHOLD, RATIO_STATUS_STYLES, formatRatioLabel } from '../utils/ratioStatus';
import { dropIdForNurse } from '../hooks/useLiveAssignments';
import { BedChip } from './BedChip';
import { CertificationBadges } from './CertificationBadges';

interface NurseAssignmentCardProps {
    nurse: NurseAssignmentRow;
    saving?: boolean;
}

export const NurseAssignmentCard = memo(function NurseAssignmentCard({ nurse, saving }: NurseAssignmentCardProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: dropIdForNurse(nurse.nurseId),
        data: { nurseId: nurse.nurseId },
    });

    const ratioStyle = RATIO_STATUS_STYLES[nurse.ratioStatus];
    const isOvertime = nurse.hoursWorkedToday > OVERTIME_HOURS_THRESHOLD;

    return (
        <article
            ref={setNodeRef}
            className={`rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition dark:bg-[#0c0a08]/40 ${
                isOver
                    ? 'border-primary/40 ring-2 ring-primary/15'
                    : 'border-gray-200/80 dark:border-white/[0.08]'
            }`}
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{nurse.displayName}</h3>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                            {nurse.role}
                        </span>
                        {nurse.isChargeNurse ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-500/10 dark:text-blue-100">
                                <Shield className="h-3 w-3" aria-hidden />
                                Charge
                            </span>
                        ) : null}
                        {nurse.isFloatPool ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-500/10 dark:text-sky-100">
                                <Waves className="h-3 w-3" aria-hidden />
                                Float
                            </span>
                        ) : null}
                        {isOvertime ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                                <Clock className="h-3 w-3" aria-hidden />
                                OT {nurse.hoursWorkedToday.toFixed(1)}h
                            </span>
                        ) : null}
                    </div>
                    <CertificationBadges certifications={nurse.certifications} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ratioStyle.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ratioStyle.dot}`} />
                        {ratioStyle.label} · {formatRatioLabel(nurse.patientCount)}
                    </span>
                    <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                        {nurse.patientCount} pt{nurse.patientCount === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            <div className="flex min-h-[2.25rem] flex-wrap gap-1.5">
                {nurse.assignedBeds.length === 0 ? (
                    <span className="text-[11px] italic text-gray-400 dark:text-gray-500">Drop beds here</span>
                ) : (
                    nurse.assignedBeds.map((bed) => (
                        <BedChip key={bed.bedId} bed={bed} nurseId={nurse.nurseId} disabled={saving} />
                    ))
                )}
            </div>
        </article>
    );
});
