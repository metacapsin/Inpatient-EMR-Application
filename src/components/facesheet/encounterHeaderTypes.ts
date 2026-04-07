export type EncounterStatusVariant = 'not_admitted' | 'active' | 'discharge_initiated';

export type EncounterHeaderAdtIntent = 'admit' | 'transfer' | 'discharge';

export interface EncounterHeaderAdtModalState {
    intent: EncounterHeaderAdtIntent;
    dischargeInitialStep?: 'initiate' | 'confirm';
}
