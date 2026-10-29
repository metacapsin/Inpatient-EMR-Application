import type { EvsCleanType, EvsStatus } from '../constants/evs';

/** EVS fields for one bed (mirrors backend evs.js queueOut). */
export interface EvsBedFields {
    evsStatus: EvsStatus;
    assignedHousekeeperId?: string;
    assignedHousekeeperName?: string;
    cleaningType?: EvsCleanType;
    dirtyAt?: string;
    cleaningStartedAt?: string;
    cleaningCompletedAt?: string;
    inspectedAt?: string;
    inspectedBy?: string;
    cleanAt?: string;
    turnaroundMinutes?: number;
}

export interface EvsHousekeeper {
    id: string;
    name: string;
    role?: string;
}

export interface EvsQueueItem extends EvsBedFields {
    id: string;
    bedId: string;
    roomBedLabel: string;
    wardId: string;
    wardName: string;
    dischargedPatientName?: string;
    dischargeTime?: string;
    encounterId?: string;
}

export interface EvsQueueMetrics {
    avgTurnaroundMinutesToday: number;
    longestWaitMinutes: number;
    bedsDirty: number;
    bedsInCleaning: number;
    bedsAvailable: number;
    bedsPendingInspection?: number;
    bedsCleanedToday?: number;
}

export interface AssignHousekeeperPayload {
    queueItemId: string;
    housekeeperId: string;
    housekeeperName: string;
}

export interface InspectPayload {
    queueItemId: string;
    inspectedBy: string;
}
