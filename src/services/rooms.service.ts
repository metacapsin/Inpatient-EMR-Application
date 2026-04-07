import api from './api';
import type { FacilityBed, FacilityRoom, FacilityWard } from '../types/facility';
import { DEFAULT_ROOM_TYPE } from '../constants/facility';
import { asRecord, extractIdString, pickString, unwrapList } from '../lib/apiPayload';
import { getApiErrorMessage } from '../lib/httpError';

/** Set `VITE_USE_MOCK_FACILITY=true` for offline UI without backend ward/room/bed APIs. */
export const USE_MOCK_FACILITY = import.meta.env.VITE_USE_MOCK_FACILITY === 'true';

const MOCK_LATENCY_MS = 180;

function mockDelay<T>(value: T): Promise<T> {
    return new Promise((resolve) => {
        window.setTimeout(() => resolve(value), MOCK_LATENCY_MS);
    });
}

const PLACEMENT_LS_KEY = 'emr_patient_placement_v1';

interface StoredPlacement {
    wardId: string;
    roomId: string;
    bedId: string;
    wardName?: string;
    roomName?: string;
    bedName?: string;
}

function readPlacements(): Record<string, StoredPlacement> {
    try {
        const raw = localStorage.getItem(PLACEMENT_LS_KEY);
        if (!raw) return {};
        const o = JSON.parse(raw) as unknown;
        return typeof o === 'object' && o !== null ? (o as Record<string, StoredPlacement>) : {};
    } catch {
        return {};
    }
}

function writePlacements(m: Record<string, StoredPlacement>) {
    localStorage.setItem(PLACEMENT_LS_KEY, JSON.stringify(m));
}

// --- In-memory cache (API mode): refreshed by list fetches for label resolution ---

let cachedWards: FacilityWard[] = [];
let cachedRooms: FacilityRoom[] = [];
let cachedBeds: FacilityBed[] = [];

function setFacilityCache(wards: FacilityWard[], rooms: FacilityRoom[], beds: FacilityBed[]) {
    cachedWards = wards;
    cachedRooms = rooms;
    cachedBeds = beds;
}

function mergeListIntoCacheWards(wards: FacilityWard[]) {
    const byId = new Map(cachedWards.map((w) => [w.id, w]));
    for (const w of wards) byId.set(w.id, w);
    cachedWards = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function mergeListIntoCacheRooms(rooms: FacilityRoom[]) {
    const byId = new Map(cachedRooms.map((r) => [r.id, r]));
    for (const r of rooms) byId.set(r.id, r);
    cachedRooms = [...byId.values()].sort((a, b) => {
        const wa = cachedWards.find((w) => w.id === a.wardId)?.name ?? '';
        const wb = cachedWards.find((w) => w.id === b.wardId)?.name ?? '';
        if (wa !== wb) return wa.localeCompare(wb);
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
}

function mergeListIntoCacheBeds(beds: FacilityBed[]) {
    const byId = new Map(cachedBeds.map((b) => [b.id, b]));
    for (const b of beds) byId.set(b.id, b);
    cachedBeds = [...byId.values()].sort((a, b) => {
        const ra = cachedRooms.find((r) => r.id === a.roomId)?.name ?? '';
        const rb = cachedRooms.find((r) => r.id === b.roomId)?.name ?? '';
        if (ra !== rb) return ra.localeCompare(rb, undefined, { numeric: true });
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
}

// --- API normalization ---

function normalizeWardRow(row: Record<string, unknown>): FacilityWard | null {
    const id = extractIdString(row._id ?? row.id ?? row.wardId);
    if (!id) return null;
    const name = pickString(row, 'wardName', 'name', 'unitName', 'title');
    return {
        id,
        name: name || id,
        code: pickString(row, 'code', 'unitCode', 'abbreviation', 'wardCode') || undefined,
    };
}

function normalizeRoomRow(row: Record<string, unknown>): FacilityRoom | null {
    const id = extractIdString(row._id ?? row.id ?? row.roomId);
    const wardId = extractIdString(row.wardId ?? row.ward_id ?? row.unitId ?? row.wardID);
    if (!id || !wardId) return null;
    const name = pickString(row, 'roomNumber', 'roomName', 'name', 'number', 'title');
    const roomType =
        pickString(row, 'roomType', 'type', 'roomCategory', 'category', 'room_type') || DEFAULT_ROOM_TYPE;
    return { id, wardId, name: name || id, roomType };
}

function roomIdFromBedRow(row: Record<string, unknown>): string {
    const direct = extractIdString(row.roomId ?? row.room_id ?? row.roomID ?? row.room_id_ref);
    if (direct) return direct;
    const pop = row.room ?? row.roomInfo ?? row.roomDetails;
    const r = asRecord(pop);
    if (r) {
        return extractIdString(r._id ?? r.id ?? r.roomId);
    }
    return '';
}

function normalizeBedRow(row: Record<string, unknown>): FacilityBed | null {
    const id = extractIdString(row._id ?? row.id ?? row.bedId ?? row.bed_id);
    const roomId = roomIdFromBedRow(row);
    if (!id || !roomId) return null;
    const name = pickString(row, 'bedLabel', 'bedName', 'name', 'bedNumber', 'number', 'label');
    const st = pickString(row, 'bedStatus', 'status', 'availability').toLowerCase();
    const occupied =
        st === 'occupied' ||
        st === 'occ' ||
        row.isOccupied === true ||
        row.occupied === true;
    const occupiedByPatientId =
        pickString(row, 'patientId', 'occupiedByPatientId', 'assignedPatientId', 'patient_id') || null;
    return {
        id,
        roomId,
        name: name || id,
        occupied: Boolean(occupied),
        occupiedByPatientId: occupied ? occupiedByPatientId : null,
    };
}

async function httpGetWardList(): Promise<FacilityWard[]> {
    try {
        const { data } = await api.get<unknown>('/Wards/getWardList');
        const rows = unwrapList(data);
        const out: FacilityWard[] = [];
        for (const item of rows) {
            const row = asRecord(item);
            if (!row) continue;
            const w = normalizeWardRow(row);
            if (w) out.push(w);
        }
        mergeListIntoCacheWards(out);
        return cachedWards.slice();
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to load wards'));
    }
}

async function httpGetRoomList(): Promise<FacilityRoom[]> {
    try {
        const { data } = await api.get<unknown>('/Rooms/getRoomList');
        const rows = unwrapList(data);
        const out: FacilityRoom[] = [];
        for (const item of rows) {
            const row = asRecord(item);
            if (!row) continue;
            const r = normalizeRoomRow(row);
            if (r) out.push(r);
        }
        mergeListIntoCacheRooms(out);
        return cachedRooms.slice();
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to load rooms'));
    }
}

async function httpGetBedList(): Promise<FacilityBed[]> {
    try {
        const { data } = await api.get<unknown>('/Beds/getBedList');
        const top = asRecord(data);
        if (top && top.status === 'error') {
            const msg = typeof top.message === 'string' ? top.message : 'Failed to load beds';
            throw new Error(msg);
        }
        const rows = unwrapList(data);
        const out: FacilityBed[] = [];
        for (const item of rows) {
            const row = asRecord(item);
            if (!row) continue;
            const b = normalizeBedRow(row);
            if (b) out.push(b);
        }
        mergeListIntoCacheBeds(out);
        return applyClientOccupancy(cachedBeds.slice());
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to load beds'));
    }
}

function applyClientOccupancy(beds: FacilityBed[]): FacilityBed[] {
    const byBed = new Map<string, string>();
    for (const [pid, bid] of patientBedAssignments) {
        byBed.set(String(bid), pid);
    }
    return beds.map((b) => {
        const holder = byBed.get(String(b.id));
        if (holder) {
            return { ...b, occupied: true, occupiedByPatientId: holder };
        }
        return { ...b };
    });
}

// --- Mock seed (string IDs) ---

let nextWardSeq = 10;
let nextRoomSeq = 100;
let nextBedSeq = 1000;

let MOCK_WARDS: FacilityWard[] = [
    { id: '1', name: 'ICU', code: 'ICU' },
    { id: '2', name: 'Medical–Surgical 3 East', code: '3E' },
    { id: '3', name: 'Telemetry 2 West', code: '2W' },
];

let MOCK_ROOMS: FacilityRoom[] = [
    { id: '1', wardId: '1', name: 'ICU-101', roomType: 'ICU' },
    { id: '2', wardId: '1', name: 'ICU-102', roomType: 'ICU' },
    { id: '3', wardId: '2', name: '301', roomType: 'General' },
    { id: '4', wardId: '2', name: '302', roomType: 'General' },
    { id: '5', wardId: '3', name: '210', roomType: 'Telemetry' },
];

let MOCK_BEDS: FacilityBed[] = [
    { id: '1', roomId: '1', name: 'Bed-1', occupied: false, occupiedByPatientId: null },
    { id: '2', roomId: '1', name: 'Bed-2', occupied: false, occupiedByPatientId: null },
    { id: '3', roomId: '2', name: 'Bed-1', occupied: false, occupiedByPatientId: null },
    { id: '4', roomId: '3', name: '301-A', occupied: false, occupiedByPatientId: null },
    { id: '5', roomId: '3', name: '301-B', occupied: false, occupiedByPatientId: null },
    { id: '6', roomId: '4', name: '302-A', occupied: false, occupiedByPatientId: null },
    { id: '7', roomId: '5', name: '210-A', occupied: false, occupiedByPatientId: null },
];

const patientBedAssignments = new Map<string, string>();

function syncBedOccupiedFlagsMock() {
    const byBed = new Map<string, string>();
    for (const [pid, bid] of patientBedAssignments) {
        byBed.set(String(bid), pid);
    }
    MOCK_BEDS = MOCK_BEDS.map((b) => {
        const holder = byBed.get(String(b.id));
        return {
            ...b,
            occupied: holder !== undefined,
            occupiedByPatientId: holder ?? null,
        };
    });
}

function wardById(id: string): FacilityWard | undefined {
    const list = USE_MOCK_FACILITY ? MOCK_WARDS : cachedWards;
    return list.find((w) => String(w.id) === String(id));
}

function roomById(id: string): FacilityRoom | undefined {
    const list = USE_MOCK_FACILITY ? MOCK_ROOMS : cachedRooms;
    return list.find((r) => String(r.id) === String(id));
}

function bedById(id: string): FacilityBed | undefined {
    const list = USE_MOCK_FACILITY ? MOCK_BEDS : cachedBeds;
    return list.find((b) => String(b.id) === String(id));
}

function assertBedInHierarchy(wardId: string, roomId: string, bedId: string): void {
    const w = wardById(wardId);
    const r = roomById(roomId);
    const b = bedById(bedId);
    if (!w || !r || !b) throw new Error('Invalid ward, room, or bed.');
    if (String(r.wardId) !== String(w.id)) throw new Error('Room does not belong to the selected ward.');
    if (String(b.roomId) !== String(r.id)) throw new Error('Bed does not belong to the selected room.');
}

export interface AssignBedPayload {
    patientId: string;
    wardId: string;
    roomId: string;
    bedId: string;
}

export interface TransferBedPayload extends AssignBedPayload {
    fromBedId?: string | null;
}

export async function getWards(): Promise<FacilityWard[]> {
    if (USE_MOCK_FACILITY) {
        const list = MOCK_WARDS.slice().sort((a, b) => a.name.localeCompare(b.name));
        return mockDelay(list);
    }
    return httpGetWardList();
}

export async function getRooms(wardId: string | number): Promise<FacilityRoom[]> {
    const wid = String(wardId).trim();
    if (!wid) return USE_MOCK_FACILITY ? mockDelay([]) : Promise.resolve([]);
    if (USE_MOCK_FACILITY) {
        const list = MOCK_ROOMS.filter((r) => String(r.wardId) === wid).sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
        return mockDelay(list);
    }
    const all = cachedRooms.length ? cachedRooms : await httpGetRoomList();
    const list = all.filter((r) => String(r.wardId) === wid).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    return list;
}

export async function getAllRooms(): Promise<FacilityRoom[]> {
    if (USE_MOCK_FACILITY) {
        const list = MOCK_ROOMS.slice().sort((a, b) => {
            const wa = wardById(a.wardId)?.name ?? '';
            const wb = wardById(b.wardId)?.name ?? '';
            if (wa !== wb) return wa.localeCompare(wb);
            return a.name.localeCompare(b.name, undefined, { numeric: true });
        });
        return mockDelay(list);
    }
    return httpGetRoomList();
}

export async function getAllBeds(): Promise<FacilityBed[]> {
    if (USE_MOCK_FACILITY) {
        syncBedOccupiedFlagsMock();
        const list = MOCK_BEDS.slice().map((b) => ({ ...b })).sort((a, b) => {
            const ra = roomById(a.roomId)?.name ?? '';
            const rb = roomById(b.roomId)?.name ?? '';
            if (ra !== rb) return ra.localeCompare(rb, undefined, { numeric: true });
            return a.name.localeCompare(b.name, undefined, { numeric: true });
        });
        return mockDelay(list);
    }
    return httpGetBedList();
}

export async function getBeds(roomId: string | number): Promise<FacilityBed[]> {
    const rid = String(roomId).trim();
    if (!rid) return USE_MOCK_FACILITY ? mockDelay([]) : Promise.resolve([]);
    if (USE_MOCK_FACILITY) {
        syncBedOccupiedFlagsMock();
        const list = MOCK_BEDS.filter((b) => String(b.roomId) === rid).sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
        return mockDelay(list.map((b) => ({ ...b })));
    }
    const all = applyClientOccupancy(cachedBeds.length ? cachedBeds.slice() : await httpGetBedList());
    const list = all.filter((b) => String(b.roomId) === rid).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    return list.map((b) => ({ ...b }));
}

function releasePatientBeds(patientId: string) {
    const pid = patientId.trim();
    if (!pid) return;
    for (const [p] of [...patientBedAssignments.entries()]) {
        if (p === pid) patientBedAssignments.delete(p);
    }
}

export async function assignBed(payload: AssignBedPayload): Promise<void> {
    const patientId = payload.patientId.trim();
    if (!patientId) throw new Error('Patient is required.');
    assertBedInHierarchy(payload.wardId, payload.roomId, payload.bedId);
    if (USE_MOCK_FACILITY) {
        syncBedOccupiedFlagsMock();
        const bed = bedById(payload.bedId);
        if (!bed) throw new Error('Bed not found.');
        if (bed.occupied && bed.occupiedByPatientId !== patientId) {
            throw new Error('That bed is already assigned to another patient.');
        }
        await mockDelay(undefined);
        releasePatientBeds(patientId);
        patientBedAssignments.set(patientId, String(payload.bedId));
        syncBedOccupiedFlagsMock();
        return;
    }
    const beds = applyClientOccupancy(cachedBeds.length ? cachedBeds.slice() : await httpGetBedList());
    const bed = beds.find((b) => String(b.id) === String(payload.bedId));
    if (!bed) throw new Error('Bed not found.');
    if (bed.occupied && bed.occupiedByPatientId && bed.occupiedByPatientId !== patientId) {
        throw new Error('That bed is already assigned to another patient.');
    }
    releasePatientBeds(patientId);
    patientBedAssignments.set(patientId, String(payload.bedId));
}

export async function transferBed(payload: TransferBedPayload): Promise<void> {
    const patientId = payload.patientId.trim();
    if (!patientId) throw new Error('Patient is required.');
    if (USE_MOCK_FACILITY) {
        if (payload.fromBedId != null && String(payload.fromBedId).trim() !== '') {
            const current = patientBedAssignments.get(patientId);
            if (current !== undefined && String(current) !== String(payload.fromBedId)) {
                throw new Error('Current bed does not match the selected transfer source.');
            }
        }
        await assignBed(payload);
        placementByPatient.set(patientId, {
            wardId: payload.wardId,
            roomId: payload.roomId,
            bedId: payload.bedId,
        });
        return;
    }
    if (payload.fromBedId != null && String(payload.fromBedId).trim() !== '') {
        const current = patientBedAssignments.get(patientId);
        if (current !== undefined && String(current) !== String(payload.fromBedId)) {
            throw new Error('Current bed does not match the selected transfer source.');
        }
    }
    await assignBed(payload);
    const labels = getPlacementDisplay({
        wardId: payload.wardId,
        roomId: payload.roomId,
        bedId: payload.bedId,
    });
    const all = readPlacements();
    all[patientId] = {
        wardId: payload.wardId,
        roomId: payload.roomId,
        bedId: payload.bedId,
        wardName: labels?.wardName,
        roomName: labels?.roomName,
        bedName: labels?.bedName,
    };
    writePlacements(all);
}

export interface PatientPlacementSnapshot {
    wardId: string;
    roomId: string;
    bedId: string;
}

const placementByPatient = new Map<string, PatientPlacementSnapshot>();

export async function getPatientPlacement(patientId: string): Promise<PatientPlacementSnapshot | null> {
    const pid = patientId.trim();
    if (!pid) return null;
    if (USE_MOCK_FACILITY) {
        const stored = placementByPatient.get(pid) ?? null;
        return mockDelay(stored);
    }
    const all = readPlacements();
    const s = all[pid];
    if (!s) return null;
    return { wardId: s.wardId, roomId: s.roomId, bedId: s.bedId };
}

export function getPlacementDisplay(
    placement: PatientPlacementSnapshot
): { wardName: string; roomName: string; bedName: string } | null {
    if (USE_MOCK_FACILITY) {
        syncBedOccupiedFlagsMock();
    }
    const w = wardById(placement.wardId);
    const r = roomById(placement.roomId);
    const b = bedById(placement.bedId);
    if (!w || !r || !b) return null;
    return { wardName: w.name, roomName: r.name, bedName: b.name };
}

export async function savePatientPlacement(patientId: string, placement: PatientPlacementSnapshot): Promise<void> {
    const pid = patientId.trim();
    if (!pid) throw new Error('Patient is required.');
    assertBedInHierarchy(placement.wardId, placement.roomId, placement.bedId);
    await assignBed({
        patientId: pid,
        wardId: placement.wardId,
        roomId: placement.roomId,
        bedId: placement.bedId,
    });
    if (USE_MOCK_FACILITY) {
        placementByPatient.set(pid, { ...placement });
        await mockDelay(undefined);
        return;
    }
    const labels = getPlacementDisplay(placement);
    const all = readPlacements();
    all[pid] = {
        wardId: placement.wardId,
        roomId: placement.roomId,
        bedId: placement.bedId,
        wardName: labels?.wardName,
        roomName: labels?.roomName,
        bedName: labels?.bedName,
    };
    writePlacements(all);
}

// --- CRUD: real API ---

function wardCreateBody(name: string, code?: string) {
    return {
        name,
        wardName: name,
        code: code ?? '',
        unitCode: code ?? '',
    };
}

function wardUpdateBody(id: string, name: string, code: string) {
    return {
        id,
        _id: id,
        name,
        wardName: name,
        code,
        unitCode: code,
    };
}

export async function createWard(input: { name: string; code?: string }): Promise<FacilityWard> {
    const nm = input.name.trim();
    if (!nm) throw new Error('Ward name is required.');
    if (USE_MOCK_FACILITY) {
        const w: FacilityWard = {
            id: String(nextWardSeq++),
            name: nm,
            code: input.code?.trim() || undefined,
        };
        MOCK_WARDS = [...MOCK_WARDS, w];
        return mockDelay(w);
    }
    let data: unknown;
    try {
        const res = await api.post<unknown>('/Wards/CreateWard', wardCreateBody(nm, input.code?.trim()));
        data = res.data;
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to create ward'));
    }
    const row = asRecord(data) ?? (unwrapList(data)[0] as Record<string, unknown> | undefined);
    const parsed = row ? normalizeWardRow(row) : null;
    if (parsed) {
        mergeListIntoCacheWards([parsed]);
        return parsed;
    }
    await httpGetWardList();
    const found = cachedWards.find((w) => w.name === nm);
    if (found) return found;
    throw new Error('Ward created but response shape was unexpected; refresh the list.');
}

export async function updateWard(id: string, input: Partial<{ name: string; code: string }>): Promise<FacilityWard> {
    if (USE_MOCK_FACILITY) {
        const idx = MOCK_WARDS.findIndex((w) => String(w.id) === String(id));
        if (idx < 0) throw new Error('Ward not found.');
        const cur = MOCK_WARDS[idx];
        const next: FacilityWard = {
            ...cur,
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.code !== undefined ? { code: input.code.trim() || undefined } : {}),
        };
        if (!next.name.trim()) throw new Error('Ward name is required.');
        MOCK_WARDS = MOCK_WARDS.map((w, i) => (i === idx ? next : w));
        return mockDelay(next);
    }
    const cur = wardById(id);
    const name = (input.name ?? cur?.name ?? '').trim();
    const code = (input.code ?? cur?.code ?? '').trim();
    if (!name) throw new Error('Ward name is required.');
    try {
        await api.put('/Wards/updateWardById', wardUpdateBody(String(id), name, code));
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to update ward'));
    }
    await httpGetWardList();
    const updated = wardById(id);
    if (!updated) throw new Error('Ward not found after update.');
    return updated;
}

export async function deleteWard(id: string): Promise<void> {
    if (USE_MOCK_FACILITY) {
        const roomIds = MOCK_ROOMS.filter((r) => String(r.wardId) === String(id)).map((r) => r.id);
        MOCK_BEDS = MOCK_BEDS.filter((b) => !roomIds.map(String).includes(String(b.roomId)));
        MOCK_ROOMS = MOCK_ROOMS.filter((r) => String(r.wardId) !== String(id));
        MOCK_WARDS = MOCK_WARDS.filter((w) => String(w.id) !== String(id));
        for (const [pid, bid] of [...patientBedAssignments.entries()]) {
            const b = bedById(bid);
            if (!b || roomIds.map(String).includes(String(b.roomId))) patientBedAssignments.delete(pid);
        }
        syncBedOccupiedFlagsMock();
        return mockDelay(undefined);
    }
    try {
        await api.delete(`/Wards/deleteWardById/${encodeURIComponent(id)}`);
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to delete ward'));
    }
    const roomIds = cachedRooms.filter((r) => String(r.wardId) === String(id)).map((r) => r.id);
    const roomIdSet = new Set(roomIds.map(String));
    for (const [pid, bid] of [...patientBedAssignments.entries()]) {
        const b = cachedBeds.find((x) => String(x.id) === String(bid));
        if (b && roomIdSet.has(String(b.roomId))) patientBedAssignments.delete(pid);
    }
    cachedBeds = cachedBeds.filter((b) => !roomIdSet.has(String(b.roomId)));
    cachedRooms = cachedRooms.filter((r) => String(r.wardId) !== String(id));
    cachedWards = cachedWards.filter((w) => String(w.id) !== String(id));
}

export async function createRoom(input: { wardId: string; roomNumber: string; roomType: string }): Promise<FacilityRoom> {
    const wardId = String(input.wardId).trim();
    const roomNumber = input.roomNumber.trim();
    const roomType = (input.roomType || DEFAULT_ROOM_TYPE).trim() || DEFAULT_ROOM_TYPE;
    if (!wardId) throw new Error('Please select a ward.');
    if (!roomNumber) throw new Error('Room number is required.');
    if (!roomType) throw new Error('Room type is required.');
    if (USE_MOCK_FACILITY) {
        if (!wardById(wardId)) throw new Error('Ward not found.');
        const r: FacilityRoom = { id: String(nextRoomSeq++), wardId, name: roomNumber, roomType };
        MOCK_ROOMS = [...MOCK_ROOMS, r];
        return mockDelay(r);
    }
    try {
        await api.post('/Rooms/CreateRoom', { wardId, roomNumber, roomType });
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to create room'));
    }
    await httpGetRoomList();
    const found =
        cachedRooms.find((x) => String(x.wardId) === wardId && x.name === roomNumber && x.roomType === roomType) ??
        cachedRooms.find((x) => String(x.wardId) === wardId && x.name === roomNumber);
    if (found) return found;
    throw new Error('Room created but could not resolve the new row. Refresh the list.');
}

export async function updateRoom(
    id: string,
    input: Partial<{ wardId: string; roomNumber: string; roomType: string }>
): Promise<FacilityRoom> {
    if (USE_MOCK_FACILITY) {
        const idx = MOCK_ROOMS.findIndex((r) => String(r.id) === String(id));
        if (idx < 0) throw new Error('Room not found.');
        if (input.wardId !== undefined && !wardById(input.wardId)) throw new Error('Ward not found.');
        const cur = MOCK_ROOMS[idx];
        const next: FacilityRoom = {
            ...cur,
            ...(input.roomNumber !== undefined ? { name: input.roomNumber.trim() } : {}),
            ...(input.roomType !== undefined ? { roomType: input.roomType.trim() || DEFAULT_ROOM_TYPE } : {}),
            ...(input.wardId !== undefined ? { wardId: String(input.wardId) } : {}),
        };
        if (!next.name.trim()) throw new Error('Room number is required.');
        MOCK_ROOMS = MOCK_ROOMS.map((r, i) => (i === idx ? next : r));
        return mockDelay(next);
    }
    const cur = roomById(id);
    const wardId = String(input.wardId ?? cur?.wardId ?? '').trim();
    const roomNumber = (input.roomNumber ?? cur?.name ?? '').trim();
    const roomType = (input.roomType ?? cur?.roomType ?? DEFAULT_ROOM_TYPE).trim() || DEFAULT_ROOM_TYPE;
    if (!wardId) throw new Error('Please select a ward.');
    if (!roomNumber) throw new Error('Room number is required.');
    try {
        await api.put('/Rooms/updateRoomById', {
            id,
            _id: id,
            wardId,
            roomNumber,
            roomType,
        });
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to update room'));
    }
    await httpGetRoomList();
    const updated = roomById(id);
    if (!updated) throw new Error('Room not found after update.');
    return updated;
}

export async function deleteRoom(id: string): Promise<void> {
    if (USE_MOCK_FACILITY) {
        MOCK_BEDS = MOCK_BEDS.filter((b) => String(b.roomId) !== String(id));
        MOCK_ROOMS = MOCK_ROOMS.filter((r) => String(r.id) !== String(id));
        for (const [pid, bid] of [...patientBedAssignments.entries()]) {
            const b = bedById(bid);
            if (!b || String(b.roomId) === String(id)) patientBedAssignments.delete(pid);
        }
        syncBedOccupiedFlagsMock();
        return mockDelay(undefined);
    }
    try {
        await api.delete(`/Rooms/deleteRoomById/${encodeURIComponent(id)}`);
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to delete room'));
    }
    cachedRooms = cachedRooms.filter((r) => String(r.id) !== String(id));
    cachedBeds = cachedBeds.filter((b) => String(b.roomId) !== String(id));
}

export async function createBed(input: { roomId: string; bedName: string }): Promise<FacilityBed> {
    const roomId = String(input.roomId).trim();
    const bedName = input.bedName.trim();
    if (!roomId) throw new Error('Please select a room.');
    if (!bedName) throw new Error('Bed name is required.');
    if (USE_MOCK_FACILITY) {
        if (!roomById(roomId)) throw new Error('Room not found.');
        const b: FacilityBed = {
            id: String(nextBedSeq++),
            roomId,
            name: bedName,
            occupied: false,
            occupiedByPatientId: null,
        };
        MOCK_BEDS = [...MOCK_BEDS, b];
        return mockDelay(b);
    }
    try {
        const { data } = await api.post<unknown>('/Beds/CreateBed', {
            roomId,
            bedLabel: bedName,
            bedName,
        });
        const resp = asRecord(data);
        if (resp && resp.status === 'error') {
            const msg = typeof resp.message === 'string' ? resp.message : 'Failed to create bed';
            throw new Error(msg);
        }
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to create bed'));
    }
    await httpGetBedList();
    const found = cachedBeds.find((x) => String(x.roomId) === roomId && x.name === bedName);
    if (found) return { ...found };
    throw new Error('Bed created but could not resolve the new row. Refresh the list.');
}

export async function updateBed(id: string, input: Partial<{ bedName: string; roomId: string }>): Promise<FacilityBed> {
    if (USE_MOCK_FACILITY) {
        const idx = MOCK_BEDS.findIndex((b) => String(b.id) === String(id));
        if (idx < 0) throw new Error('Bed not found.');
        if (input.roomId !== undefined && !roomById(input.roomId)) throw new Error('Room not found.');
        syncBedOccupiedFlagsMock();
        const cur = MOCK_BEDS[idx];
        const next: FacilityBed = {
            ...cur,
            ...(input.bedName !== undefined ? { name: input.bedName.trim() } : {}),
            ...(input.roomId !== undefined ? { roomId: String(input.roomId) } : {}),
        };
        if (!next.name.trim()) throw new Error('Bed name is required.');
        MOCK_BEDS = MOCK_BEDS.map((b, i) => (i === idx ? next : b));
        syncBedOccupiedFlagsMock();
        return mockDelay(next);
    }
    const cur = bedById(id);
    const roomId = String(input.roomId ?? cur?.roomId ?? '').trim();
    const bedName = (input.bedName ?? cur?.name ?? '').trim();
    if (!roomId) throw new Error('Please select a room.');
    if (!bedName) throw new Error('Bed name is required.');
    try {
        const { data } = await api.put<unknown>('/Beds/updateBedById', {
            id,
            _id: id,
            roomId,
            bedLabel: bedName,
            bedName,
        });
        const resp = asRecord(data);
        if (resp && resp.status === 'error') {
            const msg = typeof resp.message === 'string' ? resp.message : 'Failed to update bed';
            throw new Error(msg);
        }
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to update bed'));
    }
    await httpGetBedList();
    const updated = bedById(id);
    if (!updated) throw new Error('Bed not found after update.');
    return { ...updated };
}

export async function deleteBed(id: string): Promise<void> {
    if (USE_MOCK_FACILITY) {
        for (const [pid, bid] of [...patientBedAssignments.entries()]) {
            if (String(bid) === String(id)) patientBedAssignments.delete(pid);
        }
        MOCK_BEDS = MOCK_BEDS.filter((b) => String(b.id) !== String(id));
        syncBedOccupiedFlagsMock();
        return mockDelay(undefined);
    }
    try {
        await api.delete(`/Beds/deleteBedById/${encodeURIComponent(id)}`);
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to delete bed'));
    }
    cachedBeds = cachedBeds.filter((b) => String(b.id) !== String(id));
    for (const [pid, bid] of [...patientBedAssignments.entries()]) {
        if (String(bid) === String(id)) patientBedAssignments.delete(pid);
    }
}

/** @deprecated Use createWard / createRoom / createBed */
export const mockCreateWard = createWard;
export const mockUpdateWard = updateWard;
export const mockDeleteWard = deleteWard;
export const mockCreateRoom = createRoom;
export const mockUpdateRoom = updateRoom;
export const mockDeleteRoom = deleteRoom;
export const mockCreateBed = createBed;
export const mockUpdateBed = updateBed;
export const mockDeleteBed = deleteBed;

export function listWardsSync(): FacilityWard[] {
    if (USE_MOCK_FACILITY) {
        return MOCK_WARDS.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    return cachedWards.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function listRoomsForWardSync(wardId: string | number): FacilityRoom[] {
    const wid = String(wardId);
    const list = USE_MOCK_FACILITY ? MOCK_ROOMS : cachedRooms;
    return list.filter((r) => String(r.wardId) === wid).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
    );
}

export function listBedsForRoomSync(roomId: string | number): FacilityBed[] {
    const rid = String(roomId);
    if (USE_MOCK_FACILITY) {
        syncBedOccupiedFlagsMock();
        return MOCK_BEDS.filter((b) => String(b.roomId) === rid).sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
    }
    return applyClientOccupancy(cachedBeds.filter((b) => String(b.roomId) === rid)).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
    );
}

export function __resetRoomsMockForTests(): void {
    nextWardSeq = 10;
    nextRoomSeq = 100;
    nextBedSeq = 1000;
    MOCK_WARDS = [
        { id: '1', name: 'ICU', code: 'ICU' },
        { id: '2', name: 'Medical–Surgical 3 East', code: '3E' },
        { id: '3', name: 'Telemetry 2 West', code: '2W' },
    ];
    MOCK_ROOMS = [
        { id: '1', wardId: '1', name: 'ICU-101', roomType: 'ICU' },
        { id: '2', wardId: '1', name: 'ICU-102', roomType: 'ICU' },
        { id: '3', wardId: '2', name: '301', roomType: 'General' },
        { id: '4', wardId: '2', name: '302', roomType: 'General' },
        { id: '5', wardId: '3', name: '210', roomType: 'Telemetry' },
    ];
    MOCK_BEDS = [
        { id: '1', roomId: '1', name: 'Bed-1', occupied: false, occupiedByPatientId: null },
        { id: '2', roomId: '1', name: 'Bed-2', occupied: false, occupiedByPatientId: null },
        { id: '3', roomId: '2', name: 'Bed-1', occupied: false, occupiedByPatientId: null },
        { id: '4', roomId: '3', name: '301-A', occupied: false, occupiedByPatientId: null },
        { id: '5', roomId: '3', name: '301-B', occupied: false, occupiedByPatientId: null },
        { id: '6', roomId: '4', name: '302-A', occupied: false, occupiedByPatientId: null },
        { id: '7', roomId: '5', name: '210-A', occupied: false, occupiedByPatientId: null },
    ];
    patientBedAssignments.clear();
    placementByPatient.clear();
    cachedWards = [];
    cachedRooms = [];
    cachedBeds = [];
    syncBedOccupiedFlagsMock();
}
