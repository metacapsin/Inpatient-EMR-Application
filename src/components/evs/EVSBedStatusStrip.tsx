import type { EvsStatus } from '../../constants/evs';
import { EVS_STRIP_CLASS, EVS_STRIP_LABEL } from '../../constants/evs';

interface EVSBedStatusStripProps {
    status: EvsStatus;
    className?: string;
}

/** Bottom strip on bed board cards / table rows. */
export function EVSBedStatusStrip({ status, className = '' }: EVSBedStatusStripProps) {
    return (
        <div
            className={[
                'flex w-full items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                EVS_STRIP_CLASS[status],
                className,
            ].join(' ')}
            role="status"
            aria-label={`EVS ${EVS_STRIP_LABEL[status]}`}
        >
            {EVS_STRIP_LABEL[status]}
        </div>
    );
}
