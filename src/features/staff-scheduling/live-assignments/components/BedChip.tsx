import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { AssignedBedChip } from '../../../../types/staffing.types';
import { dragIdForBed } from '../hooks/useLiveAssignments';

const ACUITY_DOT: Record<AssignedBedChip['acuity'], string> = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-red-500',
};

interface BedChipProps {
    bed: AssignedBedChip;
    nurseId: string;
    disabled?: boolean;
}

export const BedChip = memo(function BedChip({ bed, nurseId, disabled }: BedChipProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: dragIdForBed(bed.bedId, nurseId),
        disabled,
        data: { bedId: bed.bedId, nurseId },
    });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 20 : undefined }
        : undefined;

    return (
        <button
            ref={setNodeRef}
            type="button"
            style={style}
            {...listeners}
            {...attributes}
            className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-left text-[11px] font-medium shadow-sm transition ${
                isDragging
                    ? 'border-primary/40 bg-primary/5 opacity-90 ring-2 ring-primary/20'
                    : 'border-gray-200/80 bg-white hover:border-primary/30 hover:bg-gray-50 dark:border-white/10 dark:bg-[#0c0a08]/60 dark:hover:bg-white/[0.04]'
            } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
            aria-label={`${bed.roomBedLabel} ${bed.patientInitials}`}
        >
            <span className="font-semibold text-gray-900 dark:text-white">{bed.roomBedLabel}</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-700 dark:text-gray-200">{bed.patientInitials}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ACUITY_DOT[bed.acuity]}`} title={`${bed.acuity} acuity`} />
            {bed.isolation ? (
                <span className="rounded bg-violet-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-500/15 dark:text-violet-100">
                    ISO
                </span>
            ) : null}
        </button>
    );
});
