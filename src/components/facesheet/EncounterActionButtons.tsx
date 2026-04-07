import { DoorOpen, ArrowRightLeft, UserPlus } from 'lucide-react';
import type { EncounterHeaderAdtModalState } from './encounterHeaderTypes';

export interface EncounterActionButtonsProps {
    admitted: boolean;
    dischargeInitiated: boolean;
    /** When true, transfer is disabled (no listed available beds after a successful fetch). */
    transferBlockedNoBeds: boolean;
    bedsFetchError: boolean;
    onOpenAdt: (state: EncounterHeaderAdtModalState) => void;
}

/** ADT quick actions for the compact facesheet header */
export function EncounterActionButtons({
    admitted,
    dischargeInitiated,
    transferBlockedNoBeds,
    bedsFetchError,
    onOpenAdt,
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
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-3 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 disabled:pointer-events-none disabled:opacity-45"
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
            {!dischargeInitiated ? (
                <button
                    type="button"
                    onClick={() => onOpenAdt({ intent: 'discharge', dischargeInitialStep: 'initiate' })}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-200/90 bg-amber-50 px-3 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/50 dark:border-amber-900/45 dark:bg-amber-950/35 dark:text-amber-100 dark:hover:bg-amber-950/55"
                >
                    <DoorOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Discharge
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onOpenAdt({ intent: 'discharge', dischargeInitialStep: 'confirm' })}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                    Confirm discharge
                </button>
            )}
        </div>
    );
}

export { EncounterActionButtons as ActionButtons };
