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
