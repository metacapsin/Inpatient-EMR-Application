import type { EncounterStatusVariant } from './encounterHeaderTypes';

const VARIANT_STYLES: Record<
    EncounterStatusVariant,
    string
> = {
    not_admitted:
        'bg-gray-100 text-gray-700 ring-gray-400/20 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-500/25',
    active:
        'bg-emerald-100 text-emerald-900 ring-emerald-500/25 dark:bg-emerald-950/55 dark:text-emerald-100 dark:ring-emerald-400/20',
    discharge_initiated:
        'bg-amber-100 text-amber-950 ring-amber-500/30 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-400/25',
};

export interface EncounterStatusBadgeProps {
    variant: EncounterStatusVariant;
    label: string;
    className?: string;
}

export type StatusBadgeProps = EncounterStatusBadgeProps;

export function EncounterStatusBadge({ variant, label, className = '' }: EncounterStatusBadgeProps) {
    return (
        <span
            className={`inline-flex max-w-full shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${VARIANT_STYLES[variant]} ${className}`}
        >
            {label}
        </span>
    );
}

/** Alias for design-system naming */
export { EncounterStatusBadge as StatusBadge };
