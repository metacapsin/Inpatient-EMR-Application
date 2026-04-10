import type { AxiosError } from 'axios';
import type { IpdAlerts, IpdBedRow, IpdDashboardPayload, IpdKpis } from '../types/ipdDashboard';
import { extractIdString } from '../lib/apiPayload';
import api from './api';

const IPD_PATH = '/dashboard/ipd';
const TRANSFER_PATH = '/encounters/transfer';
const DISCHARGE_PATH = '/encounters/discharge';

function num(v: unknown, fallback = 0): number {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
    }
    return fallback;
}

function str(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
}

function pickRowString(rec: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const x = rec[k];
        const s = str(x);
        if (s) return s;
    }
    return '';
}

function normalizeStatus(raw: string): string {
    const s = raw.trim();
    if (!s) return 'Available';
    const lower = s.toLowerCase();
    if (lower === 'occupied' || lower === 'available' || lower === 'cleaning') {
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }
    return s;
}

function normalizeBedRow(raw: unknown, index: number): IpdBedRow {
    const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const ward = pickRowString(rec, 'ward', 'wardName', 'ward_name');
    const room = pickRowString(rec, 'room', 'roomName', 'room_name', 'roomNumber', 'room_number');
    const bed = pickRowString(rec, 'bed', 'bedName', 'bed_name', 'bedLabel', 'bed_label', 'bedNumber', 'bed_number');
    const patientName =
        pickRowString(rec, 'patientName', 'patient_name', 'name') || null;
    const status = normalizeStatus(pickRowString(rec, 'status', 'bedStatus', 'bed_status'));
    const doctor = pickRowString(rec, 'doctor', 'doctorName', 'doctor_name', 'attendingPhysician', 'attending', 'provider');
    const admitDate =
        pickRowString(rec, 'admitDate', 'admit_date', 'admissionDate', 'admission_date', 'admittedAt', 'admissionTimestamp') ||
        null;
    const encounterId =
        extractIdString(
            rec.encounterId ??
                rec.encounter_id ??
                rec.admissionEncounterId ??
                rec.admission_encounter_id ??
                rec.encounterID
        ) ||
        extractIdString(rec.id) ||
        null;
    const patientId =
        extractIdString(rec.patientId ?? rec.patient_id) || null;
    const id =
        pickRowString(rec, 'rowId', 'bedId', 'bed_id', 'id') ||
        [ward, room, bed, String(index)].filter(Boolean).join('|') ||
        `row-${index}`;
    return {
        id,
        ward: ward || '—',
        room: room || '—',
        bed: bed || '—',
        patientName,
        status,
        doctor: doctor || '—',
        admitDate,
        encounterId,
        patientId,
    };
}

function normalizeKpis(raw: unknown): IpdKpis {
    const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        totalAdmittedPatients: num(
            rec.totalAdmittedPatients ?? rec.total_admitted_patients ?? rec.admittedPatients ?? rec.admitted
        ),
        occupiedBeds: num(rec.occupiedBeds ?? rec.occupied_beds ?? rec.occupied),
        availableBeds: num(rec.availableBeds ?? rec.available_beds ?? rec.available),
        dischargedToday: num(rec.dischargedToday ?? rec.discharged_today ?? rec.dischargesToday ?? rec.discharges_today),
    };
}

function normalizeAlerts(raw: unknown): IpdAlerts {
    const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const asLines = (v: unknown): string[] => {
        if (!v) return [];
        if (Array.isArray(v)) {
            return v.map((x) => str(x).trim()).filter(Boolean);
        }
        if (typeof v === 'string' && v.trim()) return [v.trim()];
        return [];
    };
    return {
        criticalPatients: asLines(rec.criticalPatients ?? rec.critical_patients),
        bedsPendingCleaning: asLines(rec.bedsPendingCleaning ?? rec.beds_pending_cleaning ?? rec.cleaningBeds),
        transferRequests: asLines(rec.transferRequests ?? rec.transfer_requests),
    };
}

function unwrapPayload(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const o = data as Record<string, unknown>;
    if (o.status === 'success' && 'data' in o) return o.data;
    return data;
}

export function parseIpdDashboardPayload(raw: unknown): IpdDashboardPayload {
    const root = unwrapPayload(raw);
    const rec = root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
    const kpis = normalizeKpis(rec.kpis ?? rec.kpi ?? rec.stats ?? rec);
    const bedRaw = rec.bedBoard ?? rec.bed_board ?? rec.beds ?? rec.rows ?? [];
    const bedList = Array.isArray(bedRaw) ? bedRaw : [];
    const bedBoard = bedList.map((row, i) => normalizeBedRow(row, i));
    const alerts = normalizeAlerts(rec.alerts ?? {});
    return { kpis, bedBoard, alerts };
}

export type FetchIpdDashboardResult =
    | { ok: true; data: IpdDashboardPayload }
    | { ok: false; message: string };

export async function fetchIpdDashboard(): Promise<FetchIpdDashboardResult> {
    try {
        const { data } = await api.get<unknown>(IPD_PATH);
        return { ok: true, data: parseIpdDashboardPayload(data) };
    } catch (e) {
        const ax = e as AxiosError<{ message?: string }>;
        const message =
            ax.response?.data?.message ||
            (typeof ax.response?.data === 'object' &&
            ax.response?.data !== null &&
            'error' in ax.response.data &&
            typeof (ax.response.data as { error?: string }).error === 'string'
                ? (ax.response.data as { error: string }).error
                : ax.message) ||
            'Failed to load IPD dashboard';
        return { ok: false, message };
    }
}

export type EncounterActionResult = { ok: true; message?: string } | { ok: false; message: string };

export async function postEncounterTransfer(body: {
    encounterId: string;
    newBedId: string;
    reason?: string;
}): Promise<EncounterActionResult> {
    try {
        await api.post(TRANSFER_PATH, body);
        return { ok: true };
    } catch (e) {
        const ax = e as AxiosError<{ message?: string }>;
        const message = ax.response?.data?.message || ax.message || 'Transfer failed';
        return { ok: false, message };
    }
}

export async function postEncounterDischarge(body: { encounterId: string }): Promise<EncounterActionResult> {
    try {
        await api.post(DISCHARGE_PATH, body);
        return { ok: true };
    } catch (e) {
        const ax = e as AxiosError<{ message?: string }>;
        const message = ax.response?.data?.message || ax.message || 'Discharge failed';
        return { ok: false, message };
    }
}
