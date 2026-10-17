export type EncounterStatusVariant = 'not_admitted' | 'active' | 'transferred' | 'discharge_initiated';

export type EncounterHeaderAdtIntent = 'admit' | 'transfer';

export interface EncounterHeaderAdtModalState {
    intent: EncounterHeaderAdtIntent;
}
