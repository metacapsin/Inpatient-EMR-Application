import {
    addIoRecordWithFallback,
    getIoBalanceWithFallback,
    getIoTimelineWithFallback,
} from '../features/io-tracking/api/ioRecordWithFallback';
import type {
    IoAddIntakePayload,
    IoAddOutputPayload,
    IoBalanceSummary,
    IoTimelineRow,
} from '../features/io-tracking/types/ioRecord.types';

/** POST /api/IORecord/add — falls back to in-memory mock when {@link USE_IO_MOCK} and API unavailable. */
export async function addIoRecord(payload: IoAddIntakePayload | IoAddOutputPayload): Promise<unknown> {
    return addIoRecordWithFallback(payload);
}

/** GET /api/IORecord/balance/:encounterId */
export async function getIoBalance(encounterId: string): Promise<IoBalanceSummary> {
    return getIoBalanceWithFallback(encounterId);
}

/** GET /api/IORecord/timeline/:encounterId */
export async function getIoTimeline(encounterId: string): Promise<IoTimelineRow[]> {
    return getIoTimelineWithFallback(encounterId);
}
