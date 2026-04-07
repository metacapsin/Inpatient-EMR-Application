import type { PatientLocationSnapshot } from '../types/patientLocation';
import {
    getBeds,
    getPatientPlacement,
    getPlacementDisplay,
    getRooms,
    getWards,
    listBedsForRoomSync,
    listRoomsForWardSync,
    listWardsSync,
    savePatientPlacement,
    transferBed,
    type PatientPlacementSnapshot,
} from './rooms.service';

export interface WardOption {
    id: string;
    name: string;
    code: string;
}

export interface RoomOption {
    id: string;
    wardId: string;
    name: string;
    number: string;
}

export interface BedOption {
    id: string;
    roomId: string;
    /** Display label (bed name) */
    label: string;
    occupied: boolean;
    /** Selectable only when true or current patient holds the bed */
    selectable: boolean;
}

function placementFromSnapshot(s: PatientLocationSnapshot): PatientPlacementSnapshot | null {
    const wardId = s.wardId.trim();
    const roomId = s.roomId.trim();
    const bedId = s.bedId.trim();
    if (!wardId || !roomId || !bedId) return null;
    return { wardId, roomId, bedId };
}

function snapshotFromPlacement(p: PatientPlacementSnapshot): PatientLocationSnapshot {
    const labels = getPlacementDisplay(p);
    return {
        wardId: String(p.wardId),
        wardName: labels?.wardName ?? '',
        roomId: String(p.roomId),
        roomName: labels?.roomName ?? '',
        bedId: String(p.bedId),
        bedName: labels?.bedName ?? '',
    };
}

function placementFromIdStrings(wardId: string, roomId: string, bedId: string): PatientPlacementSnapshot | null {
    const w = wardId.trim();
    const r = roomId.trim();
    const b = bedId.trim();
    if (!w || !r || !b) return null;
    return { wardId: w, roomId: r, bedId: b };
}

/**
 * When integrating APIs, replace with GET /wards.
 */
export async function fetchWardOptions(): Promise<WardOption[]> {
    const wards = await getWards();
    return wards.map((w) => ({
        id: String(w.id),
        name: w.name,
        code: w.code ?? w.name.slice(0, 4).toUpperCase(),
    }));
}

/**
 * When integrating APIs, replace with GET /wards/:wardId/rooms.
 */
export async function fetchRoomOptionsForWard(wardId: string): Promise<RoomOption[]> {
    if (!wardId.trim()) return [];
    const rooms = await getRooms(wardId);
    return rooms.map((r) => ({
        id: String(r.id),
        wardId: String(r.wardId),
        name: r.roomType ? `${r.name} (${r.roomType})` : r.name,
        number: r.name,
    }));
}

/**
 * When integrating APIs, replace with GET /rooms/:roomId/beds?patientId=.
 * Occupied beds for other patients are included but marked not selectable (disabled in UI).
 */
export async function fetchBedOptionsForRoom(roomId: string, patientId: string): Promise<BedOption[]> {
    if (!roomId.trim()) return [];
    const pid = patientId.trim();
    const beds = await getBeds(roomId);
    return beds.map((b) => {
        const occupiedByOther = Boolean(b.occupied && b.occupiedByPatientId && b.occupiedByPatientId !== pid);
        return {
            id: String(b.id),
            roomId: String(b.roomId),
            label: b.name,
            occupied: b.occupied,
            selectable: !occupiedByOther,
        };
    });
}

export function validatePatientLocationAssignment(snapshot: PatientLocationSnapshot): string | null {
    if (!snapshot.wardId.trim()) return 'Select a ward / unit.';
    if (!snapshot.roomId.trim()) return 'Select a room.';
    if (!snapshot.bedId.trim()) return 'Select a bed.';
    const p = placementFromSnapshot(snapshot);
    if (!p) return 'Invalid ward, room, or bed selection.';
    const labels = getPlacementDisplay(p);
    if (!labels) return 'The selected bed does not belong to the chosen room and ward.';
    return null;
}

export async function savePatientLocationAssignment(patientId: string, snapshot: PatientLocationSnapshot): Promise<void> {
    const err = validatePatientLocationAssignment(snapshot);
    if (err) throw new Error(err);
    const p = placementFromSnapshot(snapshot);
    if (!p) throw new Error('Invalid placement.');
    await savePatientPlacement(patientId, p);
}

/** First-time bed assignment (mock: same persistence as save; use when UX distinguishes assign vs transfer). */
export async function assignPatientLocation(patientId: string, snapshot: PatientLocationSnapshot): Promise<void> {
    await savePatientLocationAssignment(patientId, snapshot);
}

/**
 * Move patient to another bed; validates `from` against mock ADT when possible.
 */
export async function transferPatientLocation(
    patientId: string,
    snapshot: PatientLocationSnapshot,
    fromSnapshot: PatientLocationSnapshot
): Promise<void> {
    const err = validatePatientLocationAssignment(snapshot);
    if (err) throw new Error(err);
    const next = placementFromSnapshot(snapshot);
    const prev = placementFromSnapshot(fromSnapshot);
    if (!next || !prev) throw new Error('Invalid placement.');
    await transferBed({
        patientId,
        wardId: next.wardId,
        roomId: next.roomId,
        bedId: next.bedId,
        fromBedId: prev.bedId,
    });
}

export async function fetchPatientLocationAssignment(patientId: string): Promise<PatientLocationSnapshot | null> {
    const stored = await getPatientPlacement(patientId);
    if (!stored) return null;
    return snapshotFromPlacement(stored);
}

/**
 * Maps free-text location from demographics/API into facility IDs when possible (first-time form load).
 */
export function resolveSnapshotFromLabels(seed: PatientLocationSnapshot): PatientLocationSnapshot {
    const wards = listWardsSync();
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

    let wardId = seed.wardId.trim();
    let roomId = seed.roomId.trim();
    let bedId = seed.bedId.trim();

    if (!wardId && seed.wardName.trim()) {
        const wn = norm(seed.wardName);
        const w = wards.find((x) => norm(x.name) === wn || norm(x.code ?? '') === wn);
        if (w) wardId = String(w.id);
    }
    if (wardId && !roomId && seed.roomName.trim()) {
        const rn = norm(seed.roomName);
        const rooms = listRoomsForWardSync(wardId);
        const r =
            rooms.find((x) => norm(x.name) === rn) ||
            rooms.find((x) => rn && norm(x.name).includes(rn));
        if (r) roomId = String(r.id);
    }
    if (roomId && !bedId && seed.bedName.trim()) {
        const bn = norm(seed.bedName);
        const beds = listBedsForRoomSync(roomId);
        const b = beds.find((x) => norm(x.name) === bn) || beds.find((x) => bn && norm(x.name).includes(bn));
        if (b) bedId = String(b.id);
    }

    const p = placementFromIdStrings(wardId, roomId, bedId);
    if (p) {
        const full = getPlacementDisplay(p);
        if (full) {
            return {
                wardId,
                wardName: full.wardName,
                roomId,
                roomName: full.roomName,
                bedId,
                bedName: full.bedName,
            };
        }
    }

    const w = wardId ? wards.find((x) => String(x.id) === wardId) : undefined;
    const rooms = wardId ? listRoomsForWardSync(wardId) : [];
    const r = roomId ? rooms.find((x) => String(x.id) === roomId) : undefined;
    const beds = roomId ? listBedsForRoomSync(roomId) : [];
    const b = bedId ? beds.find((x) => String(x.id) === bedId) : undefined;

    return {
        wardId,
        wardName: w?.name ?? seed.wardName,
        roomId,
        roomName: r?.name ?? seed.roomName,
        bedId,
        bedName: b?.name ?? seed.bedName,
    };
}
