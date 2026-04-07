import api from './api';
import { asRecord, extractIdString, pickString, unwrapList } from '../lib/apiPayload';

export type VisitorStatusUi = 'checked-in' | 'checked-out' | 'scheduled';

export interface VisitorRecord {
    id: string;
    name: string;
    relationship: string;
    checkIn: string;
    checkOut?: string;
    status: VisitorStatusUi;
    restrictions?: string;
}

export type ContactRoleUi = 'Next of Kin' | 'Guardian' | 'Emergency Contact' | 'Family' | 'Other';

export interface FamilyContactRecord {
    id: string;
    name: string;
    relationship: string;
    role: ContactRoleUi;
    phone: string;
    email?: string;
    isNOK: boolean;
}

function mapApiVisitorStatus(s: string): VisitorStatusUi {
    const v = s.toLowerCase().replace(/\s+/g, '-');
    if (v === 'checked-in' || v === 'checkedin' || v === 'in') return 'checked-in';
    if (v === 'checked-out' || v === 'checkedout' || v === 'out') return 'checked-out';
    if (v === 'scheduled' || v === 'pending') return 'scheduled';
    return 'scheduled';
}

function visitorStatusToApi(s: VisitorStatusUi): string {
    if (s === 'checked-in') return 'checked-in';
    if (s === 'checked-out') return 'checked-out';
    return 'scheduled';
}

function normalizeRole(s: string): ContactRoleUi {
    const t = s.trim();
    const opts: ContactRoleUi[] = ['Next of Kin', 'Guardian', 'Emergency Contact', 'Family', 'Other'];
    const hit = opts.find((o) => o.toLowerCase() === t.toLowerCase());
    if (hit) return hit;
    return 'Other';
}

function parseVisitorRow(row: Record<string, unknown>): VisitorRecord | null {
    const id = extractIdString(row._id ?? row.id ?? row.visitorId);
    if (!id) return null;
    const checkIn =
        pickString(row, 'checkIn', 'checkInTime', 'checkin', 'visitStart', 'startTime', 'arrivalTime') ||
        new Date().toISOString().slice(0, 16);
    const checkOut = pickString(row, 'checkOut', 'checkOutTime', 'checkout', 'visitEnd', 'endTime', 'departureTime') || undefined;
    const statusRaw = pickString(row, 'status', 'visitorStatus', 'visitStatus');
    return {
        id,
        name: pickString(row, 'visitorName', 'name', 'fullName', 'visitor') || id,
        relationship: pickString(row, 'relationship', 'relation', 'relationShip') || '—',
        checkIn,
        checkOut,
        status: statusRaw ? mapApiVisitorStatus(statusRaw) : 'scheduled',
        restrictions: pickString(row, 'restrictions', 'notes', 'comments') || undefined,
    };
}

function parseFamilyRow(row: Record<string, unknown>): FamilyContactRecord | null {
    const id = extractIdString(row._id ?? row.id ?? row.familyContactId ?? row.contactId);
    if (!id) return null;
    const nok =
        row.isNOK === true ||
        row.isNextOfKin === true ||
        row.nextOfKin === true ||
        String(row.isNOK ?? row.isNextOfKin ?? '').toLowerCase() === 'true';
    return {
        id,
        name: pickString(row, 'name', 'fullName', 'familyContactName', 'contactName') || id,
        relationship: pickString(row, 'relationship', 'relation') || '',
        role: normalizeRole(pickString(row, 'role', 'contactRole', 'type', 'contactType')),
        phone: pickString(row, 'phone', 'phoneNumber', 'mobile', 'cellPhone') || '',
        email: pickString(row, 'email', 'emailAddress') || undefined,
        isNOK: Boolean(nok),
    };
}

function listParams(patientId: string) {
    return { patientId, PatientId: patientId };
}

export async function fetchVisitorsForPatient(patientId: string): Promise<VisitorRecord[]> {
    const pid = patientId.trim();
    if (!pid) return [];
    const { data } = await api.get<unknown>('/Visitors/getVisitorList', { params: listParams(pid) });
    const rows = unwrapList(data);
    const out: VisitorRecord[] = [];
    for (const item of rows) {
        const row = asRecord(item);
        if (!row) continue;
        const v = parseVisitorRow(row);
        if (v) out.push(v);
    }
    return out;
}

export async function createVisitorForPatient(patientId: string, v: Omit<VisitorRecord, 'id'>): Promise<void> {
    const pid = patientId.trim();
    if (!pid) throw new Error('Patient is required.');
    await api.post('/Visitors/CreateVisitor', {
        patientId: pid,
        visitorName: v.name,
        name: v.name,
        relationship: v.relationship,
        checkInTime: v.checkIn,
        checkOutTime: v.checkOut ?? '',
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        status: visitorStatusToApi(v.status),
        visitorStatus: visitorStatusToApi(v.status),
        restrictions: v.restrictions ?? '',
        notes: v.restrictions ?? '',
    });
}

export async function updateVisitorRecord(id: string, patientId: string, v: Omit<VisitorRecord, 'id'>): Promise<void> {
    await api.put('/Visitors/updateVisitorById', {
        id,
        _id: id,
        patientId: patientId.trim(),
        visitorName: v.name,
        name: v.name,
        relationship: v.relationship,
        checkInTime: v.checkIn,
        checkOutTime: v.checkOut ?? '',
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        status: visitorStatusToApi(v.status),
        visitorStatus: visitorStatusToApi(v.status),
        restrictions: v.restrictions ?? '',
        notes: v.restrictions ?? '',
    });
}

export async function deleteVisitorRecord(id: string): Promise<void> {
    await api.delete(`/Visitors/deleteVisitorById/${encodeURIComponent(id)}`);
}

export async function fetchFamilyContactsForPatient(patientId: string): Promise<FamilyContactRecord[]> {
    const pid = patientId.trim();
    if (!pid) return [];
    const { data } = await api.get<unknown>('/PatientFamily/getFamilyContactList', { params: listParams(pid) });
    const rows = unwrapList(data);
    const out: FamilyContactRecord[] = [];
    for (const item of rows) {
        const row = asRecord(item);
        if (!row) continue;
        const c = parseFamilyRow(row);
        if (c) out.push(c);
    }
    return out;
}

export async function createFamilyContactForPatient(patientId: string, c: Omit<FamilyContactRecord, 'id'>): Promise<void> {
    const pid = patientId.trim();
    if (!pid) throw new Error('Patient is required.');
    await api.post('/PatientFamily/CreateFamilyContact', {
        patientId: pid,
        name: c.name,
        familyContactName: c.name,
        fullName: c.name,
        relationship: c.relationship,
        role: c.role,
        contactRole: c.role,
        phone: c.phone,
        phoneNumber: c.phone,
        email: c.email ?? '',
        emailAddress: c.email ?? '',
        isNOK: c.isNOK,
        isNextOfKin: c.isNOK,
        nextOfKin: c.isNOK,
    });
}

export async function updateFamilyContactRecord(id: string, patientId: string, c: Omit<FamilyContactRecord, 'id'>): Promise<void> {
    await api.put('/PatientFamily/updateFamilyContactById', {
        id,
        _id: id,
        patientId: patientId.trim(),
        name: c.name,
        familyContactName: c.name,
        fullName: c.name,
        relationship: c.relationship,
        role: c.role,
        contactRole: c.role,
        phone: c.phone,
        phoneNumber: c.phone,
        email: c.email ?? '',
        emailAddress: c.email ?? '',
        isNOK: c.isNOK,
        isNextOfKin: c.isNOK,
        nextOfKin: c.isNOK,
    });
}

export async function deleteFamilyContactRecord(id: string): Promise<void> {
    await api.delete(`/PatientFamily/deleteFamilyContactById/${encodeURIComponent(id)}`);
}
