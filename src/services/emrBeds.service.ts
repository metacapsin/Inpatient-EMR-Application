import api from './api';
import { asRecord, extractIdString, pickString, unwrapList } from '../lib/apiPayload';
import { getApiErrorMessage } from '../lib/httpError';

/** Normalized row for ADT bed pickers (IDs match POST /api/admissions and /api/transfers). */
export interface EmrBedListItem {
    id: string;
    /** Lowercase normalized: available | occupied | … */
    bedStatus: string;
    label: string;
    raw: Record<string, unknown>;
}

function extractBedId(row: Record<string, unknown>): string {
    return extractIdString(row._id ?? row.id ?? row.bedId ?? row.bed_id);
}

/**
 * Normalize to a small set so admit/transfer pickers and filters stay predictable.
 */
function normalizePickerStatus(row: Record<string, unknown>): string {
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
    if (['occupied', 'occ', 'assigned', 'held', 'busy', 'taken'].includes(s)) return 'occupied';
    if (['maintenance', 'blocked', 'unavailable', 'inactive', 'dirty'].includes(s)) return s;
    return s;
}

function bedLabel(row: Record<string, unknown>, id: string): string {
    const name = pickString(row, 'bedLabel', 'bedName', 'name', 'label', 'bedNumber', 'number', 'title');
    const room = pickString(row, 'roomName', 'room', 'roomNumber', 'room_label');
    const ward = pickString(row, 'wardName', 'ward', 'unitName', 'unit');
    const parts = [ward, room, name].filter((x) => x !== '');
    if (parts.length) return parts.join(' · ');
    return id || 'Bed';
}

/**
 * GET /Beds/getBedList — tenant responses vary; normalize to `{ id, bedStatus, label }`.
 */
export async function fetchEmrBedList(): Promise<EmrBedListItem[]> {
    try {
        const { data } = await api.get<unknown>('/Beds/getBedList');
        const o = asRecord(data);
        if (o && o.status === 'error') {
            const msg = typeof o.message === 'string' ? o.message : 'Failed to load beds';
            throw new Error(msg);
        }
        const rows = unwrapList(data);
        const out: EmrBedListItem[] = [];
        for (const item of rows) {
            const row = asRecord(item);
            if (!row) continue;
            const id = extractBedId(row);
            if (!id) continue;
            const bedStatus = normalizePickerStatus(row);
            out.push({
                id,
                bedStatus,
                label: bedLabel(row, id),
                raw: row,
            });
        }
        return out;
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to load bed list'));
    }
}

/**
 * Facesheet header line from bed list row (backed by active encounter bed id).
 * Prefers "Bed {identifier} - {ward}"; falls back to normalized list label.
 */
export function formatBedHeaderLine(bed: EmrBedListItem): string {
    const row = bed.raw;
    const bedName =
        pickString(row, 'bedLabel', 'bedName', 'name', 'label', 'bedNumber', 'number', 'title').trim() || '';
    const ward = pickString(row, 'wardName', 'ward', 'unitName', 'unit').trim() || '';
    if (bedName && ward) return `Bed ${bedName} - ${ward}`;
    if (bedName) return `Bed ${bedName}`;
    const lbl = bed.label.trim();
    if (lbl.includes('·')) {
        const parts = lbl
            .split(/\s*·\s*/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (parts.length >= 2) {
            const wardPart = parts[0];
            const bedPart = parts[parts.length - 1];
            if (bedPart && wardPart) return `Bed ${bedPart} - ${wardPart}`;
        }
    }
    if (lbl) return lbl;
    return '';
}

/**
 * Beds eligible for admit / transfer destination. Unknown/missing status is treated as available
 * (many APIs omit status for open beds).
 */
export function filterAvailableBeds(beds: EmrBedListItem[]): EmrBedListItem[] {
    return beds.filter((b) => {
        const s = b.bedStatus;
        if (s === 'occupied' || s === 'assigned' || s === 'held' || s === 'busy' || s === 'taken') return false;
        if (s === 'maintenance' || s === 'blocked' || s === 'unavailable' || s === 'inactive' || s === 'dirty')
            return false;
        if (b.raw.isOccupied === true || b.raw.occupied === true) return false;
        if (s === 'available' || s === 'vacant' || s === 'free' || s === 'open' || s === 'empty' || s === 'unoccupied')
            return true;
        if (b.raw.isAvailable === true || b.raw.available === true) return true;
        return s === '';
    });
}
