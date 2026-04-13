import api from './api';
import type {
    DischargeMedLine,
    DischargeMedPayload,
    MarRow,
    PatientMedicationRow,
    PostDispenseRequest,
    PostDischargeRequest,
    PostMarRequest,
    PostPrnStatRequest,
    PrescriptionRow,
    PrnStatRecord,
} from '../types/medicationManagement';

function useMock(): boolean {
    return import.meta.env.VITE_MEDICATION_API_MOCK !== 'false';
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

export async function getPrescriptions(patientId: string): Promise<PrescriptionRow[]> {
    if (!patientId.trim()) return [];
    if (useMock()) {
        await mockDelay();
        seedMockPatient(patientId);
        return JSON.parse(JSON.stringify(mockPrescriptions.get(patientId) || [])) as PrescriptionRow[];
    }
    const res = await api.get<unknown>(`/api/prescriptions/${encodeURIComponent(patientId)}`);
    const raw = unwrapBody<unknown>(res.data);
    if (Array.isArray(raw)) return raw as PrescriptionRow[];
    return [];
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
