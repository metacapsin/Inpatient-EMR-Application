import { subHours, subMinutes } from 'date-fns';
import { EVS_CLEAN_TYPES, EVS_STATUS, MOCK_LATENCY_MS, type EvsStatus } from '../constants/evs';
import type {
    AssignHousekeeperPayload,
    EvsBedFields,
    EvsQueueItem,
    EvsQueueMetrics,
    InspectPayload,
} from '../types/evs';

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(value), ms);
    });
}

const HOUSEKEEPERS = [
    { id: 'hk-1', name: 'Maria Santos' },
    { id: 'hk-2', name: 'James Chen' },
    { id: 'hk-3', name: 'Aisha Patel' },
    { id: 'hk-4', name: 'Robert Kim' },
] as const;

function iso(d: Date): string {
    return d.toISOString();
}

function seedQueue(): EvsQueueItem[] {
    const now = new Date();
    return [
        {
            id: 'evs-1',
            bedId: 'bed-101',
            roomBedLabel: '101-A',
            wardId: 'ward-1',
            wardName: 'Med/Surg North',
            dischargedPatientName: 'John Martinez',
            dischargeTime: iso(subHours(now, 3)),
            dirtyAt: iso(subHours(now, 2.9)),
            evsStatus: EVS_STATUS.DIRTY,
            cleaningType: 'Terminal',
        },
        {
            id: 'evs-2',
            bedId: 'bed-102',
            roomBedLabel: '101-B',
            wardId: 'ward-1',
            wardName: 'Med/Surg North',
            dischargedPatientName: 'Linda Brooks',
            dischargeTime: iso(subHours(now, 4.5)),
            dirtyAt: iso(subHours(now, 4.4)),
            evsStatus: EVS_STATUS.DIRTY,
            cleaningType: 'Discharge',
            assignedHousekeeperId: 'hk-2',
            assignedHousekeeperName: 'James Chen',
        },
        {
            id: 'evs-3',
            bedId: 'bed-201',
            roomBedLabel: '201-A',
            wardId: 'ward-2',
            wardName: 'ICU',
            dischargedPatientName: 'Robert Singh',
            dischargeTime: iso(subHours(now, 1.2)),
            dirtyAt: iso(subHours(now, 1.1)),
            evsStatus: EVS_STATUS.IN_CLEANING,
            cleaningType: 'Isolation',
            assignedHousekeeperId: 'hk-1',
            assignedHousekeeperName: 'Maria Santos',
            cleaningStartedAt: iso(subMinutes(now, 42)),
        },
        {
            id: 'evs-4',
            bedId: 'bed-202',
            roomBedLabel: '201-B',
            wardId: 'ward-2',
            wardName: 'ICU',
            dischargedPatientName: 'Emily Carter',
            dischargeTime: iso(subHours(now, 5)),
            dirtyAt: iso(subHours(now, 4.8)),
            evsStatus: EVS_STATUS.PENDING_INSPECTION,
            cleaningType: 'Terminal',
            assignedHousekeeperId: 'hk-3',
            assignedHousekeeperName: 'Aisha Patel',
            cleaningStartedAt: iso(subHours(now, 3.5)),
            cleaningCompletedAt: iso(subMinutes(now, 25)),
        },
        {
            id: 'evs-5',
            bedId: 'bed-301',
            roomBedLabel: '301-A',
            wardId: 'ward-3',
            wardName: 'Telemetry',
            dischargedPatientName: 'David Nguyen',
            dischargeTime: iso(subHours(now, 6)),
            dirtyAt: iso(subHours(now, 5.8)),
            evsStatus: EVS_STATUS.PENDING_INSPECTION,
            cleaningType: 'Routine',
            assignedHousekeeperId: 'hk-4',
            assignedHousekeeperName: 'Robert Kim',
            cleaningStartedAt: iso(subHours(now, 4.2)),
            cleaningCompletedAt: iso(subMinutes(now, 55)),
            inspectedAt: iso(subMinutes(now, 10)),
            inspectedBy: 'Charge Nurse — Lee',
        },
        {
            id: 'evs-6',
            bedId: 'bed-302',
            roomBedLabel: '301-B',
            wardId: 'ward-3',
            wardName: 'Telemetry',
            dischargedPatientName: 'Susan Wright',
            dischargeTime: iso(subHours(now, 8)),
            dirtyAt: iso(subHours(now, 7.5)),
            evsStatus: EVS_STATUS.CLEAN,
            cleaningType: 'Discharge',
            assignedHousekeeperId: 'hk-1',
            assignedHousekeeperName: 'Maria Santos',
            cleaningStartedAt: iso(subHours(now, 7)),
            cleaningCompletedAt: iso(subHours(now, 6.2)),
            inspectedAt: iso(subHours(now, 6)),
            inspectedBy: 'EVS Supervisor — Torres',
            cleanAt: iso(subHours(now, 5.8)),
            turnaroundMinutes: 102,
        },
        {
            id: 'evs-7',
            bedId: 'bed-401',
            roomBedLabel: '401-A',
            wardId: 'ward-1',
            wardName: 'Med/Surg North',
            dischargedPatientName: 'Michael Okafor',
            dischargeTime: iso(subMinutes(now, 90)),
            dirtyAt: iso(subMinutes(now, 85)),
            evsStatus: EVS_STATUS.DIRTY,
            cleaningType: 'Routine',
        },
        {
            id: 'evs-8',
            bedId: 'bed-402',
            roomBedLabel: '402-B',
            wardId: 'ward-4',
            wardName: 'Ortho',
            dischargedPatientName: 'Patricia Gomez',
            dischargeTime: iso(subHours(now, 2.5)),
            dirtyAt: iso(subHours(now, 2.4)),
            evsStatus: EVS_STATUS.IN_CLEANING,
            cleaningType: 'Discharge',
            assignedHousekeeperId: 'hk-2',
            assignedHousekeeperName: 'James Chen',
            cleaningStartedAt: iso(subMinutes(now, 18)),
        },
    ];
}

/** In-memory store — replace with HTTP client when backend is ready. */
let queueStore: EvsQueueItem[] = seedQueue();

function findItem(id: string): EvsQueueItem | undefined {
    return queueStore.find((q) => q.id === id);
}

function computeMetrics(items: EvsQueueItem[]): EvsQueueMetrics {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const completedToday = items.filter(
        (i) => i.evsStatus === EVS_STATUS.CLEAN && i.cleanAt && new Date(i.cleanAt) >= todayStart
    );
    const turnarounds = completedToday
        .map((i) => i.turnaroundMinutes)
        .filter((m): m is number => typeof m === 'number' && m > 0);
    const avgTurnaroundMinutesToday =
        turnarounds.length > 0 ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : 0;

    const now = Date.now();
    const waitMinutes = items
        .filter((i) => i.evsStatus !== EVS_STATUS.CLEAN && i.dirtyAt)
        .map((i) => Math.max(0, Math.floor((now - new Date(i.dirtyAt!).getTime()) / 60_000)));

    return {
        avgTurnaroundMinutesToday,
        longestWaitMinutes: waitMinutes.length ? Math.max(...waitMinutes) : 0,
        bedsDirty: items.filter((i) => i.evsStatus === EVS_STATUS.DIRTY).length,
        bedsInCleaning: items.filter((i) => i.evsStatus === EVS_STATUS.IN_CLEANING).length,
        bedsAvailable: items.filter((i) => i.evsStatus === EVS_STATUS.CLEAN).length,
    };
}

function turnaroundFromDirty(dirtyAt: string, cleanAt: string): number {
    return Math.max(0, Math.floor((new Date(cleanAt).getTime() - new Date(dirtyAt).getTime()) / 60_000));
}

/** Future: GET /api/evs/queue */
export async function getQueue(): Promise<EvsQueueItem[]> {
    return delay([...queueStore].sort((a, b) => {
        const ta = a.dirtyAt ? new Date(a.dirtyAt).getTime() : 0;
        const tb = b.dirtyAt ? new Date(b.dirtyAt).getTime() : 0;
        return tb - ta;
    }));
}

/** Future: GET /api/evs/metrics */
export async function getMetrics(): Promise<EvsQueueMetrics> {
    return delay(computeMetrics(queueStore));
}

/** Future: POST /api/evs/queue/:id/assign */
export async function assignHousekeeper(payload: AssignHousekeeperPayload): Promise<EvsQueueItem> {
    const item = findItem(payload.queueItemId);
    if (!item) throw new Error('Queue item not found');
    const next: EvsQueueItem = {
        ...item,
        assignedHousekeeperId: payload.housekeeperId,
        assignedHousekeeperName: payload.housekeeperName,
    };
    queueStore = queueStore.map((q) => (q.id === item.id ? next : q));
    return delay(next);
}

/** Future: POST /api/evs/queue/:id/start */
export async function startCleaning(queueItemId: string): Promise<EvsQueueItem> {
    const item = findItem(queueItemId);
    if (!item) throw new Error('Queue item not found');
    if (item.evsStatus !== EVS_STATUS.DIRTY) throw new Error('Bed must be dirty to start cleaning');
    const next: EvsQueueItem = {
        ...item,
        evsStatus: EVS_STATUS.IN_CLEANING,
        cleaningStartedAt: iso(new Date()),
        cleaningType: item.cleaningType ?? EVS_CLEAN_TYPES[0],
    };
    queueStore = queueStore.map((q) => (q.id === item.id ? next : q));
    return delay(next);
}

/** Future: POST /api/evs/queue/:id/complete */
export async function completeCleaning(queueItemId: string): Promise<EvsQueueItem> {
    const item = findItem(queueItemId);
    if (!item) throw new Error('Queue item not found');
    if (item.evsStatus !== EVS_STATUS.IN_CLEANING) throw new Error('Bed must be in cleaning');
    const next: EvsQueueItem = {
        ...item,
        evsStatus: EVS_STATUS.PENDING_INSPECTION,
        cleaningCompletedAt: iso(new Date()),
    };
    queueStore = queueStore.map((q) => (q.id === item.id ? next : q));
    return delay(next);
}

/** Future: POST /api/evs/queue/:id/inspect */
export async function inspectBed(payload: InspectPayload): Promise<EvsQueueItem> {
    const item = findItem(payload.queueItemId);
    if (!item) throw new Error('Queue item not found');
    if (item.evsStatus !== EVS_STATUS.PENDING_INSPECTION) throw new Error('Bed must await inspection');
    const next: EvsQueueItem = {
        ...item,
        inspectedAt: iso(new Date()),
        inspectedBy: payload.inspectedBy,
    };
    queueStore = queueStore.map((q) => (q.id === item.id ? next : q));
    return delay(next);
}

/** Future: POST /api/evs/queue/:id/approve */
export async function approveCleaning(queueItemId: string): Promise<EvsQueueItem> {
    const item = findItem(queueItemId);
    if (!item) throw new Error('Queue item not found');
    if (item.evsStatus !== EVS_STATUS.PENDING_INSPECTION) throw new Error('Bed must await inspection');
    const cleanAt = iso(new Date());
    const next: EvsQueueItem = {
        ...item,
        evsStatus: EVS_STATUS.CLEAN,
        cleanAt,
        turnaroundMinutes: item.dirtyAt ? turnaroundFromDirty(item.dirtyAt, cleanAt) : undefined,
    };
    queueStore = queueStore.map((q) => (q.id === item.id ? next : q));
    return delay(next);
}

export function listHousekeepers(): readonly { id: string; name: string }[] {
    return HOUSEKEEPERS;
}

function toBedFields(item: EvsQueueItem): EvsBedFields {
    return {
        evsStatus: item.evsStatus,
        assignedHousekeeperId: item.assignedHousekeeperId,
        assignedHousekeeperName: item.assignedHousekeeperName,
        cleaningType: item.cleaningType,
        dirtyAt: item.dirtyAt,
        cleaningStartedAt: item.cleaningStartedAt,
        cleaningCompletedAt: item.cleaningCompletedAt,
        inspectedAt: item.inspectedAt,
        inspectedBy: item.inspectedBy,
        cleanAt: item.cleanAt,
        turnaroundMinutes: item.turnaroundMinutes,
    };
}

/** Bed board: map bedId → EVS fields (mock). Future: GET /api/evs/beds?ids=… */
export async function getEvsFieldsByBedIds(bedIds: string[]): Promise<Record<string, EvsBedFields>> {
    const map: Record<string, EvsBedFields> = {};
    if (!bedIds.length) return delay(map);

    const activeQueue = queueStore.filter((q) => q.evsStatus !== EVS_STATUS.CLEAN);
    bedIds.forEach((id, index) => {
        const direct = queueStore.find((q) => q.bedId === id);
        const item = direct ?? activeQueue[index % Math.max(activeQueue.length, 1)];
        if (item) map[id] = toBedFields(direct ?? { ...item, bedId: id });
    });
    return delay(map);
}

/** Dev-only reset for mock demos. */
export function resetEvsMockStore(): void {
    queueStore = seedQueue();
}

export function getEvsStatusForBedSync(bedId: string): EvsStatus | undefined {
    return queueStore.find((q) => q.bedId === bedId)?.evsStatus;
}
