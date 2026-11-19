import { memo } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { DischargeReadinessSectionAvailability } from '../../../types/dischargeReadiness';
import { billingDenialsPath } from '../../../features/denial-management/services/denial.service';

type Props = {
    section: DischargeReadinessSectionAvailability | undefined;
};

/**
 * Claim preparation / submission has no server implementation yet (`sections.claimPrep.available === false`).
 * Nothing is submitted or fabricated client-side; the previous in-browser "submitted" state is gone.
 */
function BillingTabInner({ section }: Props) {
    const reason = section?.reason || 'Claim preparation is not implemented on the server yet.';
    return (
        <div className="rounded-xl border border-dashed border-gray-200/90 bg-gray-50/50 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.02]" role="status">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
                <FileText className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Claim preparation is not available</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-600 dark:text-gray-400">{reason}</p>
            <p className="mx-auto mt-2 max-w-md text-[11px] text-gray-500 dark:text-gray-500">
                Billing does not gate discharge. Denial management and CDI worklists remain available.
            </p>
            <Link
                to={billingDenialsPath()}
                className="mt-4 inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200"
            >
                Open denial management
            </Link>
        </div>
    );
}

export const BillingTab = memo(BillingTabInner);
