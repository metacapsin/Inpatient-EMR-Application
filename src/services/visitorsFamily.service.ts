import api from './api';
import { asRecord, extractIdString, pickString, unwrapList } from '../lib/apiPayload';

/** Body for CreateFamilyContact (and matching updates) — matches backend schema. */
export type PatientContactWritePayload = {
    patientId: string;
    firstName: string;
    lastName: string;
    mobilePhone: string;
    emailAddress: string;
    relationship: string;
    isEmergencyContact: boolean;
    isAuthorizedForInfo: boolean;
    status: boolean;
};

export type VisitorStatusUi = 'checked-in' | 'checked-out' | 'scheduled';

/** Visitor row — field names match list API (`getVisitorList`). */
export interface VisitorRecord {
    id: string;
    firstName: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    restrictions: string | null;
    status: string;
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

function buildFamilyContactWritePayload(patientId: string, c: Omit<FamilyContactRecord, 'id'>): PatientContactWritePayload {
    const pid = patientId.trim();
    return {
        patientId: pid,
        firstName: c.name.trim(),
        lastName: '',
        mobilePhone: c.phone.trim(),
        emailAddress: (c.email ?? '').trim(),
        relationship: c.relationship.trim(),
        isEmergencyContact: Boolean(c.isNOK),
        isAuthorizedForInfo: true,
        status: true,
    };
}

function normalizeRole(s: string): ContactRoleUi {
    const t = s.trim();
    const opts: ContactRoleUi[] = ['Next of Kin', 'Guardian', 'Emergency Contact', 'Family', 'Other'];
    const hit = opts.find((o) => o.toLowerCase() === t.toLowerCase());
    if (hit) return hit;
    return 'Other';
}

function pickNullableIsoString(row: Record<string, unknown>, key: string): string | null {
    const v = row[key];
    if (v == null) return null;
    const s = typeof v === 'string' ? v.trim() : String(v).trim();
    return s || null;
}

/** First non-empty value among keys (list rows may use `checkOutAt` or legacy `checkOutTime`). */
function pickNullableIsoStringFirst(row: Record<string, unknown>, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = pickNullableIsoString(row, k);
        if (v) return v;
    }
    return null;
}

function parseVisitorRow(row: Record<string, unknown>): VisitorRecord | null {
    const id = extractIdString(row._id ?? row.id ?? row.visitorId);
    if (!id) return null;
    return {
        id,
        firstName: pickString(row, 'firstName'),
        checkInAt: pickNullableIsoStringFirst(row, 'checkInAt', 'checkInTime'),
        checkOutAt: pickNullableIsoStringFirst(row, 'checkOutAt', 'checkOutTime'),
        restrictions: pickNullableIsoString(row, 'restrictions'),
        status: pickString(row, 'status'),
    };
}

function parseFamilyRow(row: Record<string, unknown>): FamilyContactRecord | null {
    const id = extractIdString(row._id ?? row.id ?? row.familyContactId ?? row.contactId);
    if (!id) return null;
    const nok =
        row.isEmergencyContact === true ||
        row.isNOK === true ||
        row.isNextOfKin === true ||
        row.nextOfKin === true ||
        String(row.isEmergencyContact ?? row.isNOK ?? row.isNextOfKin ?? '').toLowerCase() === 'true';
    const first = pickString(row, 'firstName', 'name', 'fullName', 'familyContactName', 'contactName');
    const last = pickString(row, 'lastName');
    const nameFromParts = [first, last].filter(Boolean).join(' ').trim();
    const name = nameFromParts || pickString(row, 'name', 'fullName', 'familyContactName', 'contactName') || id;
    return {
        id,
        name,
        relationship: pickString(row, 'relationship', 'relation') || '',
        role: normalizeRole(pickString(row, 'role', 'contactRole', 'type', 'contactType')),
        phone: pickString(row, 'mobilePhone', 'phone', 'phoneNumber', 'mobile', 'cellPhone') || '',
        email: pickString(row, 'emailAddress', 'email') || undefined,
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

function visitorWriteBody(patientId: string, v: Omit<VisitorRecord, 'id'>) {
    const pid = patientId.trim();
    return {
        patientId: pid,
        firstName: v.firstName.trim(),
        checkInAt: v.checkInAt ?? '',
        checkOutAt: v.checkOutAt ?? '',
        restrictions: v.restrictions ?? '',
        status: v.status,
    };
}

export async function createVisitorForPatient(patientId: string, v: Omit<VisitorRecord, 'id'>): Promise<void> {
    const pid = patientId.trim();
    if (!pid) throw new Error('Patient is required.');
    const body = visitorWriteBody(pid, v);
    // CreateVisitor often binds legacy `checkInTime` / `checkOutTime` while update uses `*At`; mirror so checkout persists on create.
    await api.post('/Visitors/CreateVisitor', {
        ...body,
        checkInTime: body.checkInAt,
        checkOutTime: body.checkOutAt,
    });
}

export async function updateVisitorRecord(id: string, patientId: string, v: Omit<VisitorRecord, 'id'>): Promise<void> {
    await api.put('/Visitors/updateVisitorById', {
        id,
        _id: id,
        ...visitorWriteBody(patientId, v),
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
    await api.post('/PatientFamily/CreateFamilyContact', buildFamilyContactWritePayload(pid, c));
}

export async function updateFamilyContactRecord(id: string, patientId: string, c: Omit<FamilyContactRecord, 'id'>): Promise<void> {
    await api.put('/PatientFamily/updateFamilyContactById', {
        id,
        _id: id,
        ...buildFamilyContactWritePayload(patientId, c),
    });
}

export async function deleteFamilyContactRecord(id: string): Promise<void> {
    await api.delete(`/PatientFamily/deleteFamilyContactById/${encodeURIComponent(id)}`);
}
