import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';
import type {
    CreatePrescriptionRequest,
    Pharmacy,
    PharmacyInput,
    PrescriptionStatus,
    DischargeMedLine,
    DischargeMedPayload,
    MarRow,
    PatientMedicationRow,
    PostDispenseRequest,
    PostDischargeEncounterMedicationsRequest,
    PostDischargeRequest,
    PostMarRequest,
    PostPrnStatRequest,
    PrescriptionRow,
    PrnStatRecord,
} from '../types/medicationManagement';

/** Every medication route is backend-wired; the in-memory mock is opt-in only (VITE_MEDICATION_API_MOCK=true). */
function useMock(): boolean {
    return import.meta.env.VITE_MEDICATION_API_MOCK === 'true';
}

function unwrapBody<T>(body: unknown): T {
    if (body != null && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data !== undefined) {
        return (body as { data: T }).data;
    }
    return body as T;
}

// --- In-memory mock (keyed by patientId) ---

const mockMedications = new Map<string, PatientMedicationRow[]>();
const mockMar = new Map<string, MarRow[]>();
const mockPrnStat = new Map<string, PrnStatRecord[]>();
const mockPrescriptions = new Map<string, PrescriptionRow[]>();
const mockDischarge = new Map<string, DischargeMedPayload>();
const mockDischargeByEncounter = new Map<string, DischargeMedPayload>();

function isoHoursFromNow(hours: number): string {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
}

function seedMockPatient(patientId: string): void {
    if (mockMedications.has(patientId)) return;

    const meds: PatientMedicationRow[] = [
        {
            id: 'med-seed-1',
            name: 'Lisinopril',
            dose: '10 mg',
            route: 'PO',
            frequency: 'Daily',
            nextScheduledTime: isoHoursFromNow(2),
        },
        {
            id: 'med-seed-2',
            name: 'Metformin',
            dose: '500 mg',
            route: 'PO',
            frequency: 'BID',
            nextScheduledTime: isoHoursFromNow(4),
        },
    ];
    mockMedications.set(patientId, meds);

    const mar: MarRow[] = [
        {
            id: 'mar-1',
            medicationId: 'med-seed-1',
            medicationName: 'Lisinopril 10 mg PO',
            scheduledTime: isoHoursFromNow(2),
            status: 'due',
        },
        {
            id: 'mar-2',
            medicationId: 'med-seed-2',
            medicationName: 'Metformin 500 mg PO',
            scheduledTime: isoHoursFromNow(4),
            status: 'due',
        },
        {
            id: 'mar-3',
            medicationId: 'med-seed-1',
            medicationName: 'Lisinopril 10 mg PO',
            scheduledTime: isoHoursFromNow(-2),
            status: 'given',
            givenTime: isoHoursFromNow(-2),
            givenBy: 'Nurse Demo',
            remarks: '',
        },
    ];
    mockMar.set(patientId, mar);

    mockPrnStat.set(patientId, []);

    const rx: PrescriptionRow[] = [
        {
            prescriptionId: `rx-${patientId}-1`,
            patientId,
            prescriberName: 'Dr. Chen',
            orderedAt: new Date().toISOString(),
            medicines: [
                {
                    medicineId: 'rxm-1',
                    name: 'Amoxicillin',
                    strength: '500 mg capsule',
                    quantityOrdered: 20,
                    unitPrice: 0.45,
                },
                {
                    medicineId: 'rxm-2',
                    name: 'Ibuprofen',
                    strength: '200 mg tablet',
                    quantityOrdered: 30,
                    unitPrice: 0.12,
                },
            ],
        },
    ];
    mockPrescriptions.set(patientId, rx);

    mockDischarge.set(patientId, {
        patientId,
        medications: [
            {
                name: 'Lisinopril',
                dose: '10 mg',
                frequency: 'Daily',
                duration: '30 days',
                instructions: 'Take in the morning with water',
            },
        ],
        preparedBy: '',
        reviewedBy: '',
        counsellingDone: false,
    });
}

async function mockDelay(): Promise<void> {
    await new Promise((r) => setTimeout(r, 120));
}

export async function getPatientMedications(patientId: string): Promise<PatientMedicationRow[]> {
    if (!patientId.trim()) return [];
    if (useMock()) {
        await mockDelay();
        seedMockPatient(patientId);
        return [...(mockMedications.get(patientId) || [])];
    }
    const res = await api.get<unknown>(`/api/patients/${encodeURIComponent(patientId)}/medications`);
    const raw = unwrapBody<unknown>(res.data);
    if (Array.isArray(raw)) return raw as PatientMedicationRow[];
    return [];
}

export async function getMar(patientId: string): Promise<MarRow[]> {
    if (!patientId.trim()) return [];
    if (useMock()) {
        await mockDelay();
        seedMockPatient(patientId);
        return [...(mockMar.get(patientId) || [])];
    }
    const res = await api.get<unknown>(`/api/mar/${encodeURIComponent(patientId)}`);
    const raw = unwrapBody<unknown>(res.data);
    if (Array.isArray(raw)) return raw as MarRow[];
    return [];
}

export async function postMar(body: PostMarRequest): Promise<MarRow[]> {
    if (useMock()) {
        await mockDelay();
        const pid = body.patientId;
        seedMockPatient(pid);
        const rows = mockMar.get(pid) || [];
        const next = rows.map((r) => {
            if (
                r.medicationId === body.medicationId &&
                r.scheduledTime === body.scheduledTime &&
                r.status === 'due'
            ) {
                return {
                    ...r,
                    givenTime: body.givenTime,
                    givenBy: body.givenBy,
                    status: body.status,
                    remarks: body.remarks,
                };
            }
            return r;
        });
        const hadDue = rows.some(
            (r) =>
                r.medicationId === body.medicationId &&
                r.scheduledTime === body.scheduledTime &&
                r.status === 'due'
        );
        if (!hadDue) {
            next.push({
                id: `mar-${Date.now()}`,
                medicationId: body.medicationId,
                medicationName: body.medicationId,
                scheduledTime: body.scheduledTime,
                givenTime: body.givenTime,
                givenBy: body.givenBy,
                status: body.status,
                remarks: body.remarks,
            });
        }
        mockMar.set(pid, next);
        return [...next];
    }
    const res = await api.post<unknown>('/api/mar', body);
    const raw = unwrapBody<unknown>(res.data);
    if (Array.isArray(raw)) return raw as MarRow[];
    return getMar(body.patientId);
}

export async function getPrnStat(patientId: string): Promise<PrnStatRecord[]> {
    if (!patientId.trim()) return [];
    if (useMock()) {
        await mockDelay();
        seedMockPatient(patientId);
        return [...(mockPrnStat.get(patientId) || [])];
    }
    const res = await api.get<unknown>(`/api/prn-stat/${encodeURIComponent(patientId)}`);
    const raw = unwrapBody<unknown>(res.data);
    if (Array.isArray(raw)) return raw as PrnStatRecord[];
    return [];
}

export async function postPrnStat(body: PostPrnStatRequest): Promise<PrnStatRecord> {
    if (useMock()) {
        await mockDelay();
        seedMockPatient(body.patientId);
        const rec: PrnStatRecord = {
            ...body,
            id: `prn-${Date.now()}`,
            createdAt: new Date().toISOString(),
        };
        const list = mockPrnStat.get(body.patientId) || [];
        list.unshift(rec);
        mockPrnStat.set(body.patientId, list);
        return rec;
    }
    const res = await api.post<unknown>('/api/prn-stat', body);
    return unwrapBody<PrnStatRecord>(res.data);
}

export async function getPrescriptions(patientId: string, status: PrescriptionStatus | 'open' | 'all' = 'open'): Promise<PrescriptionRow[]> {
    if (!patientId.trim()) return [];
    if (useMock()) {
        await mockDelay();
        seedMockPatient(patientId);
        return JSON.parse(JSON.stringify(mockPrescriptions.get(patientId) || [])) as PrescriptionRow[];
    }
    const res = await api.get<unknown>(`/api/prescriptions/${encodeURIComponent(patientId)}`, { params: { status } });
    const raw = unwrapBody<unknown>(res.data);
    if (Array.isArray(raw)) return raw as PrescriptionRow[];
    return [];
}

// --- e-prescribing lifecycle (backend/src/routes/medication.js) ---

export async function createPrescription(body: CreatePrescriptionRequest): Promise<ServiceResult<PrescriptionRow>> {
    try {
        const res = await api.post<unknown>('/api/prescriptions', body);
        return { ok: true, data: unwrapBody<PrescriptionRow>(res.data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not create prescription') };
    }
}

async function rxAction(id: string, action: 'sign' | 'transmit' | 'print' | 'cancel', body: Record<string, unknown> = {}): Promise<ServiceResult<PrescriptionRow>> {
    try {
        const res = await api.post<unknown>(`/api/prescriptions/${encodeURIComponent(id)}/${action}`, body);
        return { ok: true, data: unwrapBody<PrescriptionRow>(res.data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, `Could not ${action} prescription`) };
    }
}
export const signPrescription = (id: string) => rxAction(id, 'sign');
export const transmitPrescription = (id: string, pharmacyId?: string) => rxAction(id, 'transmit', pharmacyId ? { pharmacyId } : {});
export const printPrescription = (id: string) => rxAction(id, 'print');
export const cancelPrescription = (id: string, reason?: string) => rxAction(id, 'cancel', reason ? { reason } : {});

export async function listPharmacies(includeInactive = false): Promise<Pharmacy[]> {
    const res = await api.get<unknown>('/api/pharmacies', { params: includeInactive ? { includeInactive: 'true' } : {} });
    const raw = unwrapBody<unknown>(res.data);
    return Array.isArray(raw) ? (raw as Pharmacy[]) : [];
}

export async function savePharmacy(body: PharmacyInput, id?: string): Promise<ServiceResult<Pharmacy>> {
    try {
        const res = id ? await api.put<unknown>(`/api/pharmacies/${encodeURIComponent(id)}`, body) : await api.post<unknown>('/api/pharmacies', body);
        return { ok: true, data: unwrapBody<Pharmacy>(res.data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not save pharmacy') };
    }
}

export async function deactivatePharmacy(id: string): Promise<ServiceResult<null>> {
    try {
        await api.delete(`/api/pharmacies/${encodeURIComponent(id)}`);
        return { ok: true, data: null };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not deactivate pharmacy') };
    }
}

export async function postDispense(body: PostDispenseRequest): Promise<{ ok: boolean }> {
    if (useMock()) {
        await mockDelay();
        return { ok: true };
    }
    const res = await api.post<unknown>('/api/dispense', body);
    return unwrapBody<{ ok: boolean }>(res.data) || { ok: true };
}

export async function getDischargeMeds(patientId: string): Promise<DischargeMedPayload> {
    if (!patientId.trim()) {
        return { patientId: '', medications: [] };
    }
    if (useMock()) {
        await mockDelay();
        seedMockPatient(patientId);
        const d = mockDischarge.get(patientId);
        return d ? { ...d, medications: [...d.medications] } : { patientId, medications: [] };
    }
    const res = await api.get<unknown>(`/api/discharge/${encodeURIComponent(patientId)}`);
    return unwrapBody<DischargeMedPayload>(res.data);
}

export async function postDischarge(body: PostDischargeRequest): Promise<DischargeMedPayload> {
    if (useMock()) {
        await mockDelay();
        const payload: DischargeMedPayload = {
            patientId: body.patientId,
            medications: [...body.medications],
            preparedBy: body.preparedBy,
            reviewedBy: body.reviewedBy,
            counsellingDone: body.counsellingDone,
        };
        mockDischarge.set(body.patientId, payload);
        return payload;
    }
    const res = await api.post<unknown>('/api/discharge', body);
    return unwrapBody<DischargeMedPayload>(res.data);
}

/** GET /api/discharges/:encounterId/medications — encounter is the billing/clinical anchor for discharge meds */
export async function getDischargeMedsForEncounter(
    encounterId: string,
    fallbackPatientId?: string
): Promise<DischargeMedPayload> {
    const eid = encounterId.trim();
    if (!eid) {
        return { patientId: fallbackPatientId?.trim() ?? '', encounterId: '', medications: [] };
    }
    if (useMock()) {
        await mockDelay();
        const hit = mockDischargeByEncounter.get(eid);
        if (hit) return { ...hit, medications: [...hit.medications] };
        const pid = fallbackPatientId?.trim() ?? '';
        if (pid) {
            seedMockPatient(pid);
            const fromPatient = mockDischarge.get(pid);
            if (fromPatient) {
                const next: DischargeMedPayload = {
                    ...fromPatient,
                    encounterId: eid,
                    patientId: fromPatient.patientId || pid,
                    medications: [...fromPatient.medications],
                };
                mockDischargeByEncounter.set(eid, next);
                return { ...next, medications: [...next.medications] };
            }
        }
        const empty: DischargeMedPayload = { patientId: pid, encounterId: eid, medications: [] };
        mockDischargeByEncounter.set(eid, empty);
        return { ...empty, medications: [] };
    }
    try {
        const res = await api.get<unknown>(`/api/discharges/${encodeURIComponent(eid)}/medications`);
        return unwrapBody<DischargeMedPayload>(res.data);
    } catch {
        const pid = fallbackPatientId?.trim();
        if (!pid) return { patientId: '', encounterId: eid, medications: [] };
        const legacy = await getDischargeMeds(pid);
        return { ...legacy, encounterId: eid };
    }
}

/** POST /api/discharges/:encounterId/medications */
export async function postDischargeMedsForEncounter(
    encounterId: string,
    body: PostDischargeEncounterMedicationsRequest
): Promise<DischargeMedPayload> {
    const eid = encounterId.trim();
    if (!eid) {
        throw new Error('An active encounter is required to save discharge medications.');
    }
    if (useMock()) {
        await mockDelay();
        const pid = body.patientId?.trim() ?? '';
        if (pid) seedMockPatient(pid);
        const payload: DischargeMedPayload = {
            patientId: pid,
            encounterId: eid,
            medications: [...body.medications],
            preparedBy: body.preparedBy,
            reviewedBy: body.reviewedBy,
            counsellingDone: body.counsellingDone,
        };
        mockDischargeByEncounter.set(eid, payload);
        if (pid) mockDischarge.set(pid, { ...payload, patientId: pid });
        return { ...payload, medications: [...payload.medications] };
    }
    const res = await api.post<unknown>(`/api/discharges/${encodeURIComponent(eid)}/medications`, body);
    return unwrapBody<DischargeMedPayload>(res.data);
}
