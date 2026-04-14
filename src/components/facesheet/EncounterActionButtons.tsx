import { ArrowRightLeft, DoorOpen, UserPlus } from 'lucide-react';
import type { EncounterHeaderAdtModalState } from './encounterHeaderTypes';

export interface EncounterActionButtonsProps {
    admitted: boolean;
    dischargeInitiated: boolean;
    /** Encounter has a non-null bed assignment in workspace state (required to begin discharge). */
    bedReadyForDischarge: boolean;
    /** When true, transfer is disabled (no listed available beds after a successful fetch). */
    transferBlockedNoBeds: boolean;
    bedsFetchError: boolean;
    onOpenAdt: (state: EncounterHeaderAdtModalState) => void;
    onStartDischarge: () => void;
}

/** ADT quick actions for the compact facesheet header */
export function EncounterActionButtons({
    admitted,
    dischargeInitiated,
    bedReadyForDischarge,
    transferBlockedNoBeds,
    bedsFetchError,
    onOpenAdt,
    onStartDischarge,
}: EncounterActionButtonsProps) {
    const transferDisabled =
        !admitted || dischargeInitiated || (transferBlockedNoBeds && !bedsFetchError);

    const transferTitle = dischargeInitiated
        ? 'Complete discharge before transferring'
        : transferBlockedNoBeds && !bedsFetchError
            ? 'No available beds in list — open ADT to enter a bed id manually'
            : undefined;

    if (!admitted) {
        return (
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={() => onOpenAdt({ intent: 'admit' })}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-3 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 disabled:pointer-events-none disabled:opacity-45 dark:border-primary-700/50 dark:bg-primary/20 dark:text-primary-200 dark:hover:bg-primary/30 dark:focus-visible:outline-primary-500/30"
                >
                    <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Admit
                </button>
            </div>
        );
    }

    return (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
                type="button"
                title={transferTitle}
                disabled={transferDisabled}
                onClick={() => onOpenAdt({ intent: 'transfer' })}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/30 disabled:pointer-events-none disabled:opacity-45 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/5"
            >
                <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Transfer
            </button>
            <button
                type="button"
                title={
                    !bedReadyForDischarge
                        ? 'No bed linked to this encounter — refresh the chart or open from the bed board'
                        : dischargeInitiated
                          ? 'Continue discharge readiness and finalization'
                          : undefined
                }
                disabled={!bedReadyForDischarge}
                onClick={onStartDischarge}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-200/90 bg-amber-50 px-3 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/50 disabled:pointer-events-none disabled:opacity-45 dark:border-amber-900/45 dark:bg-amber-950/35 dark:text-amber-100 dark:hover:bg-amber-950/55"
            >
                <DoorOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {dischargeInitiated ? 'Continue discharge' : 'Start discharge'}
            </button>
        </div>
    );
}

export { EncounterActionButtons as ActionButtons };
