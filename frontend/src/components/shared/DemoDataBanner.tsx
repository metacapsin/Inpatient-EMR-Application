import { FlaskConical } from 'lucide-react';

export interface DemoDataBannerProps {
    /** What is simulated, e.g. "Quality measures". */
    feature: string;
    /** Why: no backend yet, or an explicit mock flag. */
    reason?: 'no-backend' | 'mock-flag';
    className?: string;
}

/**
 * Mandatory marker for any screen that renders simulated data. Clinical and financial screens must
 * never show fabricated values without this banner. Rendered as a status region so screen readers
 * announce it.
 */
export function DemoDataBanner({ feature, reason = 'no-backend', className = '' }: DemoDataBannerProps) {
    const why =
        reason === 'mock-flag'
            ? 'This environment has the in-memory mock enabled for this module. Nothing shown here is stored or real.'
            : 'This module has no server-side implementation yet. The data shown is sample data and does not belong to any patient.';
    return (
        <div
            role="status"
            aria-label={`Demo data: ${feature}`}
            className={`mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 ${className}`}
        >
            <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div>
                <span className="font-semibold uppercase tracking-wide">Demo data — {feature}</span>
                <span className="ml-1">{why} Do not use for patient care or billing.</span>
            </div>
        </div>
    );
}
