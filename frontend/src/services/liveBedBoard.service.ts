import type {
    LiveBedBoardBed,
    LiveBedBoardEncounter,
    LiveBedBoardPatient,
    LiveBedBoardPayload,
    LiveBedBoardQueryParams,
    LiveBedBoardRoom,
    LiveBedBoardRow,
    LiveBedBoardSummary,
    LiveBedBoardWard,
} from '../types/liveBedBoard';
import { asRecord, extractIdString, pickString, unwrapSuccessObjectData } from '../lib/apiPayload';
import { getApiErrorMessage } from '../lib/httpError';
import api from './api';

function normalizeBedStatus(row: Record<string, unknown>): string {
    if (row.isOccupied === true || row.occupied === true || row.is_occupied === true) {
        return 'occupied';
    }
    if (row.isAvailable === true || row.available === true) {
        return 'available';
    }
    const raw = pickString(row, 'bedStatus', 'status', 'availability', 'bedAvailability', 'state', 'bed_state');
    const s = raw.toLowerCase().replace(/\s+/g, '-');
    if (!s) return '';
    if (['available', 'avail', 'vacant', 'free', 'open', 'empty', 'unoccupied'].includes(s)) return 'available';
    if (s === 'hold' || s === 'held') return 'hold';
    if (['occupied', 'occ', 'assigned', 'busy', 'taken'].includes(s)) return 'occupied';
    if (['maintenance', 'blocked', 'unavailable', 'inactive', 'dirty'].includes(s)) return s;
    return s;
}

function bedLabelFromRow(row: Record<string, unknown>, id: string): string {
    const name = pickString(row, 'bedLabel', 'bedName', 'name', 'label', 'bedNumber', 'number', 'title');
    const room = pickString(row, 'roomName', 'room', 'roomNumber', 'room_label');
    const ward = pickString(row, 'wardName', 'ward', 'unitName', 'unit');
    const parts = [ward, room, name].filter((x) => x !== '');
    if (parts.length) return parts.join(' · ');
    return id || 'Bed';
}

function parseBed(v: unknown): LiveBedBoardBed | null {
    const row = asRecord(v);
    if (!row) return null;
    const id = extractIdString(row._id ?? row.id ?? row.bedId ?? row.bed_id);
    if (!id) return null;
    const bedStatus = normalizeBedStatus(row);
    return {
        id,
        bedStatus,
        label: bedLabelFromRow(row, id),
    };
}

function parseWard(v: unknown): LiveBedBoardWard | null {
    const row = asRecord(v);
    if (!row) return null;
    const id = extractIdString(row._id ?? row.id ?? row.wardId);
    if (!id) return null;
    const name = pickString(row, 'wardName', 'name', 'unitName', 'title') || id;
    return { id, name };
}

function parseRoom(v: unknown): LiveBedBoardRoom | null {
    const row = asRecord(v);
    if (!row) return null;
    const id = extractIdString(row._id ?? row.id ?? row.roomId);
    if (!id) return null;
    const name = pickString(row, 'roomNumber', 'roomName', 'name', 'number', 'title') || id;
    const wardId = extractIdString(row.wardId ?? row.ward_id ?? row.unitId) || undefined;
    return { id, name, ...(wardId ? { wardId } : {}) };
}

function parseEncounter(v: unknown): LiveBedBoardEncounter | null {
    const row = asRecord(v);
    if (!row) return null;
    const id = extractIdString(row._id ?? row.id ?? row.encounterId);
    if (!id) return null;
    return {
        id,
        admissionTimestamp:
            pickString(row, 'admissionTimestamp', 'admissionDate', 'admittedAt', 'startDate', 'createdAt') || undefined,
        status: pickString(row, 'status', 'encounterStatus') || undefined,
        patientId: extractIdString(row.patientId ?? row.patient_id) || pickString(row, 'patientId') || undefined,
        bedId: extractIdString(row.bedId ?? row.bed_id) || undefined,
    };
}

function parsePatient(v: unknown): LiveBedBoardPatient | null {
    const row = asRecord(v);
    if (!row) return null;
    const id = extractIdString(row._id ?? row.id ?? row.patientId);
    if (!id) return null;
    const displayName =
        pickString(
            row,
            'displayName',
            'fullName',
            'patientName',
            'name',
            'legalName',
            'firstName'
        ) ||
        [pickString(row, 'firstName'), pickString(row, 'lastName')].filter(Boolean).join(' ').trim();
    const mrn =
        pickString(row, 'mrn', 'medicalRecordNumber', 'patientMrn', 'chartNumber', 'mpi', 'externalId') || '';
    const dateOfBirth = pickString(row, 'dateOfBirth', 'dob', 'birthDate') || undefined;
    return {
        id,
        displayName: displayName || id,
        mrn,
        ...(dateOfBirth ? { dateOfBirth } : {}),
    };
}

function parseSummary(v: unknown): LiveBedBoardSummary {
    const row = asRecord(v);
    if (!row) {
        return {
            totalBeds: 0,
            byStatus: {},
            withActiveEncounter: 0,
            occupiedWithoutEncounter: 0,
        };
    }
    const byRaw = asRecord(row.byStatus);
    const byStatus: Record<string, number> = {};
    if (byRaw) {
        for (const [k, val] of Object.entries(byRaw)) {
            const n = typeof val === 'number' ? val : Number(val);
            if (Number.isFinite(n)) byStatus[k] = n;
        }
    }
    return {
        totalBeds: Number(row.totalBeds) || 0,
        byStatus,
        withActiveEncounter: Number(row.withActiveEncounter) || 0,
        occupiedWithoutEncounter: Number(row.occupiedWithoutEncounter) || 0,
    };
}

function parseRow(item: unknown): LiveBedBoardRow | null {
    const row = asRecord(item);
    if (!row) return null;
    const bed = parseBed(row.bed);
    if (!bed) return null;
    return {
        bed,
        room: parseRoom(row.room),
        ward: parseWard(row.ward),
        encounter: parseEncounter(row.encounter),
        patient: parsePatient(row.patient),
    };
}

function buildQueryParams(params?: LiveBedBoardQueryParams): Record<string, string> | undefined {
    if (!params) return undefined;
    const out: Record<string, string> = {};
    const w = params.wardId?.trim();
    const r = params.roomId?.trim();
    const b = params.bedStatus?.trim();
    if (w) out.wardId = w;
    if (r) out.roomId = r;
    if (b) out.bedStatus = b;
    return Object.keys(out).length ? out : undefined;
}

/**
 * GET /Beds/getLiveBedBoard
 */
export async function fetchLiveBedBoard(params?: LiveBedBoardQueryParams): Promise<LiveBedBoardPayload> {
    try {
        const { data } = await api.get<unknown>('/Beds/getLiveBedBoard', { params: buildQueryParams(params) });
        const top = asRecord(data);
        if (top && top.status === 'error') {
            const msg = typeof top.message === 'string' ? top.message : 'Failed to load live bed board';
            throw new Error(msg);
        }
        const inner = unwrapSuccessObjectData(data) ?? asRecord(top?.data);
        if (!inner) {
            throw new Error('Invalid bed board response');
        }
        const rowsRaw = inner.rows;
        const rowsIn = Array.isArray(rowsRaw) ? rowsRaw : [];
        const rows: LiveBedBoardRow[] = [];
        for (const item of rowsIn) {
            const parsed = parseRow(item);
            if (parsed) rows.push(parsed);
        }
        const summary = parseSummary(inner.summary);
        return { rows, summary };
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to load live bed board'));
    }
}
