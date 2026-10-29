import type { EvsBedFields } from './evs';

/** Narrow patient fields for bed board display (PHI: same handling as other clinical lists). */
export type LiveBedBoardPatient = {
    id: string;
    displayName: string;
    mrn: string;
    dateOfBirth?: string;
};

export type LiveBedBoardWard = {
    id: string;
    name: string;
};

export type LiveBedBoardRoom = {
    id: string;
    name: string;
    wardId?: string;
    roomType?: string;
    /** Room-level isolation flag (negative pressure / private isolation room). */
    isolationRequired?: boolean;
    isolationType?: string | null;
};

/** Active timed hold on a bed (bed_reservations). */
export type LiveBedBoardReservation = {
    id: string;
    patientId: string | null;
    patientName: string | null;
    expiresAt: string;
};

/** Open housekeeping job on a bed (evs_queue). */
export type LiveBedBoardCleaning = {
    id: string;
    evsStatus: string;
    cleaningType?: string;
    dirtyAt?: string;
};

export type LiveBedBoardBed = {
    id: string;
    bedStatus: string;
    label: string;
};

export type LiveBedBoardEncounter = {
    id: string;
    admissionTimestamp?: string;
    status?: string;
    patientId?: string;
    bedId?: string;
};

export type LiveBedBoardRow = {
    bed: LiveBedBoardBed;
    room: LiveBedBoardRoom | null;
    ward: LiveBedBoardWard | null;
    encounter: LiveBedBoardEncounter | null;
    patient: LiveBedBoardPatient | null;
    /** EVS overlay from GET /api/evs/beds (latest job per bed). */
    evs?: EvsBedFields;
    /** Who the bed is held for, when bedStatus === 'hold'. */
    reservation?: LiveBedBoardReservation | null;
    /** Open cleaning job, when bedStatus === 'dirty' (or a hold placed on a dirty bed). */
    cleaning?: LiveBedBoardCleaning | null;
};

export type LiveBedBoardSummary = {
    totalBeds: number;
    /** Counts keyed by normalized bed status label */
    byStatus: Record<string, number>;
    withActiveEncounter: number;
    occupiedWithoutEncounter: number;
};

export type LiveBedBoardPayload = {
    rows: LiveBedBoardRow[];
    summary: LiveBedBoardSummary;
};

export type LiveBedBoardQueryParams = {
    wardId?: string;
    roomId?: string;
    bedStatus?: string;
};
