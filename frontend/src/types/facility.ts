/**
 * Facility hierarchy for wards / rooms / beds.
 * IDs are strings to match Mongo-style APIs and numeric string IDs alike.
 */
export type FacilityId = string;

export interface FacilityWard {
    id: FacilityId;
    name: string;
    /** Short code for display (e.g. ICU) */
    code?: string;
}

export interface FacilityRoom {
    id: FacilityId;
    wardId: FacilityId;
    /** Room number (matches API `roomNumber`). */
    name: string;
    /** Matches API `roomType` (e.g. General, ICU). */
    roomType: string;
    /** Room-level isolation flag (negative pressure / private isolation room). */
    isolationRequired?: boolean;
    isolationType?: string | null;
}

export interface FacilityBed {
    id: FacilityId;
    roomId: FacilityId;
    name: string;
    occupied: boolean;
    /** When occupied, which patient holds the bed (client-side until ADT APIs wire in). */
    occupiedByPatientId?: string | null;
    /** Raw bed status: available | occupied | hold | maintenance | blocked | dirty */
    status?: string;
}

/** Statuses an admin may set by hand (occupied is ADT-derived and never set manually). */
export const BED_MANUAL_STATUSES = ['available', 'hold', 'maintenance', 'blocked', 'dirty'] as const;
export type BedManualStatus = (typeof BED_MANUAL_STATUSES)[number];
