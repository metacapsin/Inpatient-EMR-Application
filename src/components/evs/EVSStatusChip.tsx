import type { EvsStatus } from '../../constants/evs';
import { EVS_STATUS_CHIP_CLASS, EVS_STATUS_LABEL } from '../../constants/evs';

interface EVSStatusChipProps {
    status: EvsStatus;
    className?: string;
}

export function EVSStatusChip({ status, className = '' }: EVSStatusChipProps) {
    return (
        <span
            className={[
                'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight ring-1 ring-inset',
                EVS_STATUS_CHIP_CLASS[status],
                className,
            ].join(' ')}
        >
            {EVS_STATUS_LABEL[status]}
        </span>
    );
}
