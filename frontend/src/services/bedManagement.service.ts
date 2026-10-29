/**
 * Bed management API client: timed bed holds (reservations), placement soft-warnings and the
 * transfer-request queue. Backed by backend/src/routes/bedReservations.js and transferRequests.js.
 */
import api from './api';
import { getApiErrorMessage } from '../lib/httpError';

type Envelope<T> = { status: string; message?: string; data?: T };
const enc = encodeURIComponent;

async function request<T>(method: 'get' | 'post' | 'put', url: string, body?: unknown, params?: Record<string, string>, fallback = 'Request failed'): Promise<T> {
    try {
        const { data } =
            method === 'get'
                ? await api.get<Envelope<T>>(url, { params })
                : method === 'post'
                  ? await api.post<Envelope<T>>(url, body ?? {})
                  : await api.put<Envelope<T>>(url, body ?? {});
        if (data?.data === undefined) throw new Error(data?.message || fallback);
        return data.data;
    } catch (e) {
        throw new Error(getApiErrorMessage(e, fallback));
    }
}

// ------------------------------------------------------------------ reservations (timed holds)

export type BedReservationStatus = 'active' | 'fulfilled' | 'expired' | 'cancelled';

export interface BedReservation {
    id: string;
    bedId: string;
    bedLabel: string;
    bedStatus: string;
    roomId: string;
    roomNumber: string;
    wardId: string;
    wardName: string;
    /** "Ward · Room · Bed" */
    displayLabel: string;
    patientId: string | null;
    patientName: string | null;
    mrn: string | null;
    encounterId: string | null;
    reservedBy: string | null;
    reservedByName: string | null;
    reservedAt: string;
    expiresAt: string;
    status: BedReservationStatus;
    resolvedAt: string | null;
    notes: string | null;
}

export interface ReserveBedInput {
    patientId?: string;
    encounterId?: string;
    /** 5–1440; defaults to 120 on the server. */
    expiresInMinutes?: number;
    notes?: string;
}

export const HOLD_DURATION_OPTIONS = [
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 240, label: '4 hours' },
    { value: 480, label: '8 hours' },
    { value: 1440, label: '24 hours' },
] as const;

export function reserveBed(bedId: string, input: ReserveBedInput): Promise<BedReservation> {
    return request<BedReservation>('post', `/api/beds/${enc(bedId)}/reserve`, input, undefined, 'Could not reserve bed');
}

export function listReservations(filters?: { status?: BedReservationStatus | 'all'; bedId?: string; patientId?: string }): Promise<BedReservation[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.bedId) params.bedId = filters.bedId;
    if (filters?.patientId) params.patientId = filters.patientId;
    return request<BedReservation[]>('get', '/api/bed-reservations', undefined, params, 'Failed to load bed reservations');
}

export function cancelReservation(id: string): Promise<BedReservation> {
    return request<BedReservation>('post', `/api/bed-reservations/${enc(id)}/cancel`, {}, undefined, 'Could not cancel reservation');
}

export function extendReservation(id: string, expiresInMinutes: number): Promise<BedReservation> {
    return request<BedReservation>('post', `/api/bed-reservations/${enc(id)}/extend`, { expiresInMinutes }, undefined, 'Could not extend reservation');
}

// ------------------------------------------------------------------ placement check (soft warnings)

export type PlacementWarningSeverity = 'info' | 'warning' | 'error';

export interface PlacementWarning {
    code: string;
    severity: PlacementWarningSeverity;
    message: string;
}

export interface PlacementCheck {
    bed: { id: string; label: string; status: string; wardId: string; wardName: string; roomId: string; roomNumber: string };
    room: { roomType: string; isolationRequired: boolean; isolationType: string | null };
    patient: { id: string; sex: string | null; isolationActive: boolean; isolationType: string | null } | null;
    roommates: { initials: string; bedLabel: string; sex: string | null; isolationActive: boolean }[];
    reservation: { id: string; patientId: string | null; expiresAt: string } | null;
    warnings: PlacementWarning[];
    /** false only when a hard rule (occupied / held for someone else / dirty) would reject the placement. */
    ok: boolean;
}

/**
 * Advisory check before admit/transfer/reserve. Isolation and mixed-sex-room findings are hospital
 * policy / best-practice warnings (not a US federal requirement) — the server never blocks on them.
 */
export function checkPlacement(bedId: string, who: { patientId?: string; encounterId?: string }): Promise<PlacementCheck> {
    const params: Record<string, string> = {};
    if (who.patientId) params.patientId = who.patientId;
    if (who.encounterId) params.encounterId = who.encounterId;
    return request<PlacementCheck>('get', `/api/beds/${enc(bedId)}/placement-check`, undefined, params, 'Placement check failed');
}

// ------------------------------------------------------------------ transfer requests

export type TransferPriority = 'low' | 'medium' | 'high' | 'urgent';
export const TRANSFER_PRIORITIES: { value: TransferPriority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
];

export interface TransferRequest {
    id: string;
    patientId: string;
    patientName: string;
    mrn: string;
    encounterId: string;
    encounterStatus: string;
    currentBedId: string | null;
    currentLocation: string | null;
    requestedWardId: string | null;
    requestedWardName: string | null;
    requestedBy: string | null;
    requestedByName: string | null;
    requestedAt: string;
    priority: TransferPriority;
    reason: string | null;
    status: 'open' | 'fulfilled' | 'cancelled';
    fulfilledBedId: string | null;
    fulfilledBedLabel: string | null;
    resolvedAt: string | null;
}

export function listTransferRequests(filters?: { status?: TransferRequest['status'] | 'all'; wardId?: string }): Promise<TransferRequest[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.wardId) params.wardId = filters.wardId;
    return request<TransferRequest[]>('get', '/api/transfer-requests', undefined, params, 'Failed to load transfer requests');
}

export function createTransferRequest(input: { patientId?: string; encounterId?: string; requestedWardId?: string; priority: TransferPriority; reason?: string }): Promise<TransferRequest> {
    return request<TransferRequest>('post', '/api/transfer-requests', input, undefined, 'Could not create transfer request');
}

export function cancelTransferRequest(id: string): Promise<TransferRequest> {
    return request<TransferRequest>('post', `/api/transfer-requests/${enc(id)}/cancel`, {}, undefined, 'Could not cancel transfer request');
}

export function fulfillTransferRequest(id: string, bedId: string, reason?: string): Promise<{ request: TransferRequest; currentBedId: string; encounterId: string }> {
    return request('post', `/api/transfer-requests/${enc(id)}/fulfill`, { bedId, ...(reason ? { reason } : {}) }, undefined, 'Could not fulfil transfer request');
}
