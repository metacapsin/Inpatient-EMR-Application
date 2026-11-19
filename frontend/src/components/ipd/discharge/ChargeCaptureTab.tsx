import { memo } from 'react';
import { Receipt } from 'lucide-react';
import type { DischargeReadinessSectionAvailability } from '../../../types/dischargeReadiness';

type Props = {
    section: DischargeReadinessSectionAvailability | undefined;
};

/**
 * Charge capture has no server implementation yet. The server reports this through
 * `sections.charges.available`; nothing is simulated client-side.
 */
function ChargeCaptureTabInner({ section }: Props) {
    const reason = section?.reason || 'Charge capture is not implemented on the server yet.';
    return (
        <div className="rounded-xl border border-dashed border-gray-200/90 bg-gray-50/50 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.02]" role="status">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
                <Receipt className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Charges are not available</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-600 dark:text-gray-400">{reason}</p>
            <p className="mx-auto mt-2 max-w-md text-[11px] text-gray-500 dark:text-gray-500">
                Charges do not gate discharge. Clinical discharge is controlled by the server gates shown above.
            </p>
        </div>
    );
}

export const ChargeCaptureTab = memo(ChargeCaptureTabInner);
